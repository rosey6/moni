<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/push_config.php';
require_once __DIR__ . '/lib/push_security.php';

moniMethod('GET', 'POST', 'DELETE');
$method = $_SERVER['REQUEST_METHOD'];
$userId = moniRequireAuth($method !== 'GET');
$enabled = moniPushAvailable();
if ($method === 'GET') {
    moniHandleDatabase(function () use ($pdo, $userId, $enabled): void {
        $statement = $pdo->prepare('SELECT COUNT(*) FROM push_devices WHERE utilisateur_id = :user AND active = 1');
        $statement->execute(['user' => $userId]);
        $deviceId = (int) ($_SESSION['push_device_id'] ?? 0);
        if ($deviceId > 0) {
            $current = $pdo->prepare('SELECT id FROM push_devices WHERE id = :id AND utilisateur_id = :user AND active = 1');
            $current->execute(['id' => $deviceId, 'user' => $userId]);
            $deviceId = (int) $current->fetchColumn();
        }
        moniSuccess(['enabled' => $enabled, 'activeDevices' => (int) $statement->fetchColumn(), 'currentDevice' => $deviceId ?: null]);
    });
}
$body = moniBody();

moniHandleDatabase(function () use ($pdo, $userId, $method, $body): void {
    if ($method === 'DELETE') {
        $deviceId = moniId($body['deviceId'] ?? $_SESSION['push_device_id'] ?? null, 'device');
        $pdo->beginTransaction();
        try {
            $device = $pdo->prepare('SELECT id FROM push_devices WHERE id = :id AND utilisateur_id = :user FOR UPDATE');
            $device->execute(['id' => $deviceId, 'user' => $userId]);
            if (!$device->fetch()) moniError('NOT_FOUND', 'Appareil introuvable.', 404);
            $pdo->prepare("UPDATE push_deliveries SET status = 'cancelled', lease_owner = NULL, lease_until = NULL, updated_at = UTC_TIMESTAMP(6) WHERE device_id = :id AND status IN ('pending', 'leased')")->execute(['id' => $deviceId]);
            $pdo->prepare('UPDATE push_devices SET active = 0, subscription_ciphertext = \'\', updated_at = UTC_TIMESTAMP(6) WHERE id = :id AND utilisateur_id = :user')->execute(['id' => $deviceId, 'user' => $userId]);
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
        if ((int) ($_SESSION['push_device_id'] ?? 0) === $deviceId) unset($_SESSION['push_device_id']);
        moniSuccess(['revoked' => true]);
    }

    try {
        $subscription = moniValidatePushSubscription($body['subscription'] ?? null);
        $timezone = moniIanaTimezone($body['timezone'] ?? null);
        $encryptionKey = moniPushEncryptionKey();
    } catch (InvalidArgumentException $exception) {
        moniError('INVALID_SUBSCRIPTION', 'Abonnement push invalide.', 422);
    } catch (RuntimeException $exception) {
        moniError('PUSH_UNAVAILABLE', 'Enregistrement push indisponible.', 503);
    }
    unset($encryptionKey);

    moniRequirePushRateLimit($pdo, $userId);
    $endpointHash = hash('sha256', $subscription['endpoint'], true);
    $plaintext = json_encode($subscription, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    $ciphertext = moniEncryptPushSubscription($plaintext, $userId, $endpointHash);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
        $existing = $pdo->prepare('SELECT id, utilisateur_id, active FROM push_devices WHERE endpoint_hash = :hash FOR UPDATE');
        $existing->execute(['hash' => $endpointHash]);
        $device = $existing->fetch();
        if ($device && (int) $device['utilisateur_id'] !== $userId && (int) $device['active'] === 1) moniError('DEVICE_OWNED', 'Cet appareil est déjà associé à un autre compte.', 409);
        if (!$device || (int) $device['utilisateur_id'] !== $userId) {
            $count = $pdo->prepare('SELECT COUNT(*) FROM push_devices WHERE utilisateur_id = :user AND active = 1');
            $count->execute(['user' => $userId]);
            if ((int) $count->fetchColumn() >= 10) moniError('DEVICE_LIMIT', 'Nombre maximal d’appareils atteint.', 429);
        }
        $save = $pdo->prepare('INSERT INTO push_devices (utilisateur_id, endpoint_hash, subscription_ciphertext, active, created_at, updated_at) VALUES (:user, :hash, :ciphertext, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE utilisateur_id = IF(active = 0, VALUES(utilisateur_id), utilisateur_id), subscription_ciphertext = VALUES(subscription_ciphertext), active = 1, updated_at = UTC_TIMESTAMP(6)');
        $save->execute(['user' => $userId, 'hash' => $endpointHash, 'ciphertext' => $ciphertext]);
        $deviceId = $device ? (int) $device['id'] : (int) $pdo->lastInsertId();
        if ($deviceId < 1) {
            $lookup = $pdo->prepare('SELECT id FROM push_devices WHERE endpoint_hash = :hash AND utilisateur_id = :user');
            $lookup->execute(['hash' => $endpointHash, 'user' => $userId]);
            $deviceId = (int) $lookup->fetchColumn();
        }
        if ($deviceId < 1) throw new RuntimeException('Push device was not persisted.');
        $pdo->prepare('INSERT INTO notification_user_config (utilisateur_id, timezone, updated_at) VALUES (:user, :timezone, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE timezone = VALUES(timezone), updated_at = UTC_TIMESTAMP(6)')->execute(['user' => $userId, 'timezone' => $timezone]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    $_SESSION['push_device_id'] = $deviceId;
    moniSuccess(['deviceId' => $deviceId], 201);
});
