<?php
declare(strict_types=1);

function moniPushAllowedHosts(): array
{
    return ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
}

function moniValidatePushEndpoint(string $endpoint): array
{
    if (strlen($endpoint) > 2048) throw new InvalidArgumentException('Push endpoint is too long.');
    $parts = parse_url($endpoint);
    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) {
        throw new InvalidArgumentException('Invalid push endpoint.');
    }
    $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));
    if (!in_array($host, moniPushAllowedHosts(), true) || (isset($parts['port']) && $parts['port'] !== 443) || !isset($parts['path']) || $parts['path'] === '/') {
        throw new InvalidArgumentException('Push service is not allowed.');
    }
    return ['endpoint' => $endpoint, 'host' => $host];
}

function moniValidatePushSubscription(mixed $value): array
{
    if (!is_array($value) || !is_array($value['keys'] ?? null)) throw new InvalidArgumentException('Invalid push subscription.');
    $endpoint = is_string($value['endpoint'] ?? null) ? moniValidatePushEndpoint($value['endpoint']) : null;
    $p256dh = $value['keys']['p256dh'] ?? null;
    $auth = $value['keys']['auth'] ?? null;
    if ($endpoint === null || !is_string($p256dh) || !preg_match('/^[A-Za-z0-9_-]{87}$/', $p256dh) || !is_string($auth) || !preg_match('/^[A-Za-z0-9_-]{22}$/', $auth)) {
        throw new InvalidArgumentException('Invalid push keys.');
    }
    $publicKey = base64_decode(strtr($p256dh, '-_', '+/') . '=', true);
    $authSecret = base64_decode(strtr($auth, '-_', '+/') . '==', true);
    if ($publicKey === false || strlen($publicKey) !== 65 || $publicKey[0] !== "\x04" || $authSecret === false || strlen($authSecret) !== 16) {
        throw new InvalidArgumentException('Invalid push key material.');
    }
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $publicKey;
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    $ecKey = openssl_pkey_get_public($pem);
    $details = $ecKey === false ? false : openssl_pkey_get_details($ecKey);
    if (!is_array($details) || ($details['type'] ?? null) !== OPENSSL_KEYTYPE_EC || ($details['ec']['curve_name'] ?? null) !== 'prime256v1') {
        throw new InvalidArgumentException('Invalid P-256 push public key.');
    }
    return ['endpoint' => $endpoint['endpoint'], 'keys' => ['p256dh' => $p256dh, 'auth' => $auth]];
}

function moniResolvePublicPushAddress(string $host, ?callable $resolver = null): string
{
    if (!in_array(strtolower($host), moniPushAllowedHosts(), true)) throw new RuntimeException('Push host is not allowed.');
    $records = $resolver ? $resolver($host) : dns_get_record($host, DNS_A | DNS_AAAA);
    if (!is_array($records) && $resolver === null) {
        $records = dns_get_record($host, DNS_A);
        if (!is_array($records)) {
            $ipv4 = gethostbynamel($host);
            if (is_array($ipv4)) $records = array_map(static fn(string $address): array => ['ip' => $address], $ipv4);
        }
    }
    if (!is_array($records)) throw new RuntimeException('Push DNS resolution failed.');
    $addresses = [];
    foreach ($records as $record) {
        $address = is_string($record) ? $record : ($record['ip'] ?? $record['ipv6'] ?? null);
        if (!is_string($address)) continue;
        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            throw new RuntimeException('Push host resolved to a non-public address.');
        }
        $addresses[] = $address;
    }
    if ($addresses === []) throw new RuntimeException('Push host has no public address.');
    return $addresses[0];
}

function moniPushEncryptionKey(): string
{
    $key = base64_decode(getenv('MONI_PUSH_ENCRYPTION_KEY') ?: '', true);
    if ($key === false || strlen($key) !== 32) throw new RuntimeException('Push encryption key is unavailable.');
    return $key;
}

function moniPushDecryptionKeys(): array
{
    $keys = [moniPushEncryptionKey()];
    $previous = getenv('MONI_PUSH_ENCRYPTION_KEY_PREVIOUS') ?: '';
    if ($previous === '') return $keys;
    $oldKey = base64_decode($previous, true);
    if ($oldKey === false || strlen($oldKey) !== 32) throw new RuntimeException('Previous push encryption key is invalid.');
    if (!hash_equals($keys[0], $oldKey)) $keys[] = $oldKey;
    return $keys;
}

function moniEncryptPushSubscription(string $plaintext, int $userId, string $endpointHash): string
{
    $nonce = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', moniPushEncryptionKey(), OPENSSL_RAW_DATA, $nonce, $tag, $userId . ':' . bin2hex($endpointHash), 16);
    if (!is_string($ciphertext) || strlen($tag) !== 16) throw new RuntimeException('Push subscription encryption failed.');
    return "MNP1" . $nonce . $tag . $ciphertext;
}

function moniDecryptPushSubscription(string $blob, int $userId, string $endpointHash): string
{
    if (strlen($blob) < 32 || substr($blob, 0, 4) !== 'MNP1') throw new RuntimeException('Push subscription ciphertext is invalid.');
    foreach (moniPushDecryptionKeys() as $key) {
        $plaintext = openssl_decrypt(substr($blob, 32), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($blob, 4, 12), substr($blob, 16, 16), $userId . ':' . bin2hex($endpointHash));
        if (is_string($plaintext)) return $plaintext;
    }
    throw new RuntimeException('Push subscription authentication failed.');
}

function moniRequirePushRateLimit(PDO $pdo, int $userId): void
{
    $pdo->beginTransaction();
    try {
        $upsert = $pdo->prepare("INSERT INTO push_registration_rate (utilisateur_id, window_started_at, attempts) VALUES (:user, UTC_TIMESTAMP(6), 1) ON DUPLICATE KEY UPDATE attempts = IF(window_started_at < UTC_TIMESTAMP(6) - INTERVAL 1 HOUR, 1, attempts + 1), window_started_at = IF(window_started_at < UTC_TIMESTAMP(6) - INTERVAL 1 HOUR, UTC_TIMESTAMP(6), window_started_at)");
        $upsert->execute(['user' => $userId]);
        $read = $pdo->prepare('SELECT attempts FROM push_registration_rate WHERE utilisateur_id = :user FOR UPDATE');
        $read->execute(['user' => $userId]);
        $attempts = (int) $read->fetchColumn();
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    if ($attempts > 10) moniError('RATE_LIMITED', 'Trop de demandes d’appareils. Réessaie plus tard.', 429);
}

function moniIanaTimezone(mixed $value): string
{
    if (!is_string($value) || strlen($value) > 64 || !in_array($value, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true)) {
        throw new InvalidArgumentException('Invalid IANA timezone.');
    }
    return $value;
}
