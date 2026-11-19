<?php
declare(strict_types=1);

require_once __DIR__ . '/notification_events.php';
require_once __DIR__ . '/push_security.php';
require_once __DIR__ . '/secure_push_http_client.php';

interface MoniPushTransport
{
    public function send(array $subscription, string $payload): array;
}

final class MoniWebPushTransport implements MoniPushTransport
{
    private Minishlink\WebPush\WebPush $client;

    public function __construct()
    {
        $public = getenv('MONI_VAPID_PUBLIC_KEY') ?: '';
        $privateFile = getenv('MONI_VAPID_PRIVATE_KEY_FILE') ?: '';
        $subject = getenv('MONI_VAPID_SUBJECT') ?: '';
        $private = $privateFile !== '' && is_file($privateFile) ? trim((string) file_get_contents($privateFile)) : '';
        if ($public === '' || $private === '' || !preg_match('/^mailto:[^\s@]+@[^\s@]+$|^https:\/\//', $subject)) {
            throw new RuntimeException('VAPID server configuration is incomplete.');
        }
        $factory = new Nyholm\Psr7\Factory\Psr17Factory();
        $this->client = new Minishlink\WebPush\WebPush(
            ['VAPID' => ['subject' => $subject, 'publicKey' => $public, 'privateKey' => $private]],
            ['TTL' => 60, 'urgency' => 'normal'],
            new MoniSecurePushHttpClient(),
            $factory,
            $factory
        );
    }

    public function send(array $subscription, string $payload): array
    {
        $report = $this->client->sendOneNotification(Minishlink\WebPush\Subscription::create($subscription), $payload);
        $response = $report->getResponse();
        return ['status' => $response?->getStatusCode() ?? 0, 'retryAfter' => $response?->getHeaderLine('Retry-After') ?? ''];
    }
}

final class MoniSimulatedPushTransport implements MoniPushTransport
{
    private Minishlink\WebPush\WebPush $client;

    public function __construct()
    {
        if (getenv('MONI_TEST_POOL') !== 'moni-validation') throw new RuntimeException('Simulated transport is restricted to the isolated test pool.');
        $status = filter_var(getenv('MONI_PUSH_SIMULATED_STATUS') ?: '202', FILTER_VALIDATE_INT);
        if ($status === false || !in_array($status, [202, 404, 410, 429, 500, 503], true)) throw new RuntimeException('Invalid simulated transport status.');
        $factory = new Nyholm\Psr7\Factory\Psr17Factory();
        $mock = new class($factory, $status) implements Psr\Http\Client\ClientInterface {
            public function __construct(private Nyholm\Psr7\Factory\Psr17Factory $factory, private int $status) {}
            public function sendRequest(Psr\Http\Message\RequestInterface $request): Psr\Http\Message\ResponseInterface
            {
                $response = $this->factory->createResponse($this->status);
                if ($this->status === 429 || $this->status >= 500) $response = $response->withHeader('Retry-After', '60');
                return $response;
            }
        };
        $this->client = new Minishlink\WebPush\WebPush(
            ['VAPID' => ['subject' => 'mailto:notifications-test@example.test', 'publicKey' => getenv('MONI_VAPID_PUBLIC_KEY') ?: '', 'privateKey' => getenv('MONI_VAPID_PRIVATE_KEY') ?: '']],
            ['TTL' => 60, 'urgency' => 'normal'],
            $mock,
            $factory,
            $factory
        );
    }

    public function send(array $subscription, string $payload): array
    {
        $report = $this->client->sendOneNotification(Minishlink\WebPush\Subscription::create($subscription), $payload);
        $response = $report->getResponse();
        return ['status' => $response?->getStatusCode() ?? 0, 'retryAfter' => $response?->getHeaderLine('Retry-After') ?? ''];
    }
}

function moniPushWorkerId(): string
{
    return bin2hex(random_bytes(16));
}

function moniClaimEvents(PDO $pdo, string $workerId, int $limit = 25): array
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare("SELECT id FROM notification_events WHERE status = 'pending' AND next_attempt_at <= UTC_TIMESTAMP(6) AND due_at <= UTC_TIMESTAMP(6) AND (lease_until IS NULL OR lease_until < UTC_TIMESTAMP(6)) AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP(6)) ORDER BY due_at, id LIMIT :max_rows FOR UPDATE SKIP LOCKED");
        $statement->bindValue(':max_rows', $limit, PDO::PARAM_INT);
        $statement->execute();
        $ids = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
        if ($ids !== []) {
            $claim = $pdo->prepare("UPDATE notification_events SET status = 'processing', lease_owner = :owner, lease_until = UTC_TIMESTAMP(6) + INTERVAL 60 SECOND, attempts = attempts + 1 WHERE id = :id AND status = 'pending'");
            foreach ($ids as $id) $claim->execute(['owner' => $workerId, 'id' => $id]);
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    if ($ids === []) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $read = $pdo->prepare("SELECT * FROM notification_events WHERE id IN ($in) AND lease_owner = ? AND status = 'processing' ORDER BY due_at, id");
    $read->execute([...$ids, $workerId]);
    return $read->fetchAll();
}

function moniEventObsolete(PDO $pdo, array $event): bool
{
    $key = (string) $event['event_key'];
    if ($event['event_type'] === 'budget' && preg_match('/^budget:(\d{4}-\d{2}):([a-z_]+):(80|100|over)$/', $key, $match)) {
        $snapshot = moniBudgetSnapshot($pdo, (int) $event['utilisateur_id'], $match[2], $match[1] . '-01');
        $limit = $snapshot['limit'];
        if ($limit <= 0) return true;
        return match ($match[3]) {
            '80' => !moniThresholdAtLeast($snapshot['spent'], $limit, 80) || moniThresholdAtLeast($snapshot['spent'], $limit, 100),
            '100' => !moniThresholdAtLeast($snapshot['spent'], $limit, 100) || $snapshot['spent'] > $limit,
            'over' => $snapshot['spent'] <= $limit,
        };
    }
    if ($event['event_type'] === 'savings' && preg_match('/^savings:(\d+):(25|50|75|100)$/', $key, $match)) {
        $goalId = (int) $match[1];
        $goal = $pdo->prepare("SELECT mode, montant_cible FROM objectifs_epargne WHERE id = :goal AND utilisateur_id = :user");
        $goal->execute(['goal' => $goalId, 'user' => $event['utilisateur_id']]);
        $row = $goal->fetch();
        if (!$row || $row['mode'] !== 'goal' || $row['montant_cible'] === null) return true;
        return !moniThresholdAtLeast(moniSavingsTotal($pdo, (int) $event['utilisateur_id'], $goalId), (int) $row['montant_cible'], (int) $match[2]);
    }
    if ($event['event_type'] === 'subscription' && preg_match('/^subscription:(\d+):(\d{4}-\d{2}-\d{2}):(0|1|3)$/', $key, $match)) {
        $statement = $pdo->prepare('SELECT jour_facturation FROM abonnements WHERE id = :id AND utilisateur_id = :user');
        $statement->execute(['id' => $match[1], 'user' => $event['utilisateur_id']]);
        $billingDay = $statement->fetchColumn();
        if ($billingDay === false) return true;
        $due = new DateTimeImmutable($match[2], new DateTimeZone('UTC'));
        return moniSubscriptionDue((int) $due->format('Y'), (int) $due->format('n'), (int) $billingDay, new DateTimeZone('UTC'))->format('Y-m-d') !== $match[2];
    }
    if ($event['event_type'] === 'savings' && preg_match('/^savings-due:(\d+):(\d{4}-\d{2}-\d{2}):7$/', $key, $match)) {
        $goal = $pdo->prepare("SELECT montant_cible FROM objectifs_epargne WHERE id = :id AND utilisateur_id = :user AND mode = 'goal' AND date_cible = :due");
        $goal->execute(['id' => $match[1], 'user' => $event['utilisateur_id'], 'due' => $match[2]]);
        $target = $goal->fetchColumn();
        return $target === false || $target === null || moniSavingsTotal($pdo, (int) $event['utilisateur_id'], (int) $match[1]) >= (int) $target;
    }
    return false;
}

function moniReservePushQuota(PDO $pdo, array $event, string $localDate): bool
{
    $existing = $pdo->prepare('SELECT 1 FROM push_event_quota WHERE event_id = :event');
    $existing->execute(['event' => $event['id']]);
    if ($existing->fetchColumn()) return true;
    $pdo->prepare('INSERT INTO push_daily_quota (utilisateur_id, local_date, reserved_count) VALUES (:user, :date, 0) ON DUPLICATE KEY UPDATE reserved_count = reserved_count')->execute(['user' => $event['utilisateur_id'], 'date' => $localDate]);
    $quota = $pdo->prepare('SELECT reserved_count FROM push_daily_quota WHERE utilisateur_id = :user AND local_date = :date FOR UPDATE');
    $quota->execute(['user' => $event['utilisateur_id'], 'date' => $localDate]);
    if ((int) $quota->fetchColumn() >= 3) return false;
    $pdo->prepare('UPDATE push_daily_quota SET reserved_count = reserved_count + 1 WHERE utilisateur_id = :user AND local_date = :date')->execute(['user' => $event['utilisateur_id'], 'date' => $localDate]);
    $pdo->prepare('INSERT INTO push_event_quota (event_id, utilisateur_id, local_date) VALUES (:event, :user, :date)')->execute(['event' => $event['id'], 'user' => $event['utilisateur_id'], 'date' => $localDate]);
    return true;
}

function moniProcessEvent(PDO $pdo, array $event, string $workerId, bool $pushEnabled): void
{
    $pdo->beginTransaction();
    try {
        $lock = $pdo->prepare('SELECT * FROM notification_events WHERE id = :id AND lease_owner = :owner AND status = \'processing\' FOR UPDATE');
        $lock->execute(['id' => $event['id'], 'owner' => $workerId]);
        $event = $lock->fetch();
        if (!$event) { $pdo->rollBack(); return; }
        $finish = static function (PDO $pdo, array $event, string $status): void {
            $pdo->prepare('UPDATE notification_events SET status = :status, lease_owner = NULL, lease_until = NULL, updated_at = UTC_TIMESTAMP(6) WHERE id = :id')->execute(['status' => $status, 'id' => $event['id']]);
        };
        if (!$pushEnabled) { $finish($pdo, $event, 'skipped_disabled'); $pdo->commit(); return; }
        if (moniEventObsolete($pdo, $event)) { $finish($pdo, $event, 'cancelled'); $pdo->commit(); return; }
        $security = $event['event_type'] === 'security';
        if (!$security && !moniFinancialNotificationsEnabled($pdo, (int) $event['utilisateur_id'])) { $finish($pdo, $event, 'skipped_preference'); $pdo->commit(); return; }
        $zoneQuery = $pdo->prepare("SELECT COALESCE((SELECT timezone FROM notification_user_config WHERE utilisateur_id = :user), 'UTC')");
        $zoneQuery->execute(['user' => $event['utilisateur_id']]);
        $zone = new DateTimeZone((string) $zoneQuery->fetchColumn());
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $scheduled = moniNextPushTime($now, $zone, $security);
        if ($scheduled > $now) {
            $due = $scheduled->format('Y-m-d H:i:s.u');
            $pdo->prepare("UPDATE notification_events SET status = 'pending', due_at = :due, next_attempt_at = :next_attempt, lease_owner = NULL, lease_until = NULL WHERE id = :id")->execute(['due' => $due, 'next_attempt' => $due, 'id' => $event['id']]);
            $pdo->commit();
            return;
        }
        $devices = $pdo->prepare('SELECT id FROM push_devices WHERE utilisateur_id = :user AND active = 1');
        $devices->execute(['user' => $event['utilisateur_id']]);
        $deviceIds = array_map('intval', $devices->fetchAll(PDO::FETCH_COLUMN));
        if ($deviceIds === []) { $finish($pdo, $event, 'skipped_no_devices'); $pdo->commit(); return; }
        if (!$security && !moniReservePushQuota($pdo, $event, $now->setTimezone($zone)->format('Y-m-d'))) { $finish($pdo, $event, 'suppressed_quota'); $pdo->commit(); return; }
        $delivery = $pdo->prepare("INSERT IGNORE INTO push_deliveries (event_id, device_id, status, next_attempt_at, expires_at, attempts, updated_at) VALUES (:event, :device, 'pending', :due, :expires, 0, UTC_TIMESTAMP(6))");
        foreach ($deviceIds as $deviceId) $delivery->execute(['event' => $event['id'], 'device' => $deviceId, 'due' => $now->format('Y-m-d H:i:s.u'), 'expires' => $event['expires_at']]);
        $finish($pdo, $event, 'queued');
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
}

function moniClaimDeliveries(PDO $pdo, string $workerId, int $limit = 25): array
{
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare("SELECT d.id FROM push_deliveries d INNER JOIN notification_events e ON e.id = d.event_id INNER JOIN push_devices p ON p.id = d.device_id WHERE d.status = 'pending' AND d.next_attempt_at <= UTC_TIMESTAMP(6) AND (d.expires_at IS NULL OR d.expires_at > UTC_TIMESTAMP(6)) AND e.status = 'queued' AND p.active = 1 ORDER BY d.next_attempt_at, d.id LIMIT :max_rows FOR UPDATE SKIP LOCKED");
        $statement->bindValue(':max_rows', $limit, PDO::PARAM_INT);
        $statement->execute();
        $ids = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
        if ($ids !== []) {
            $claim = $pdo->prepare("UPDATE push_deliveries SET status = 'leased', lease_owner = :owner, lease_until = UTC_TIMESTAMP(6) + INTERVAL 60 SECOND, attempts = attempts + 1, updated_at = UTC_TIMESTAMP(6) WHERE id = :id AND status = 'pending'");
            foreach ($ids as $id) $claim->execute(['owner' => $workerId, 'id' => $id]);
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    if ($ids === []) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $read = $pdo->prepare("SELECT d.*, e.utilisateur_id, e.event_type, e.event_key, e.payload_json, e.expires_at AS event_expires_at, p.endpoint_hash, p.subscription_ciphertext FROM push_deliveries d INNER JOIN notification_events e ON e.id = d.event_id INNER JOIN push_devices p ON p.id = d.device_id WHERE d.id IN ($in) AND d.lease_owner = ? AND d.status = 'leased' AND p.active = 1 ORDER BY d.id");
    $read->execute([...$ids, $workerId]);
    return $read->fetchAll();
}

function moniDeliveryRetryTime(array $result, int $attempt): DateTimeImmutable
{
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $delay = min(3600, 30 * (2 ** min(7, max(0, $attempt - 1))));
    $retryAfter = trim((string) ($result['retryAfter'] ?? ''));
    if ($retryAfter !== '') {
        if (ctype_digit($retryAfter)) $delay = min(3600, max(30, (int) $retryAfter));
        else {
            $timestamp = strtotime($retryAfter);
            if ($timestamp !== false) $delay = min(3600, max(30, $timestamp - $now->getTimestamp()));
        }
    }
    return $now->modify('+' . $delay . ' seconds');
}

function moniProcessDelivery(PDO $pdo, array $delivery, string $workerId, MoniPushTransport $transport): void
{
    $owner = $delivery['lease_owner'];
    try {
        $blob = (string) $delivery['subscription_ciphertext'];
        $json = moniDecryptPushSubscription($blob, (int) $delivery['utilisateur_id'], (string) $delivery['endpoint_hash']);
        $subscription = moniValidatePushSubscription(json_decode($json, true, 8, JSON_THROW_ON_ERROR));
        if (moniEventObsolete($pdo, $delivery) || ($delivery['event_type'] !== 'security' && !moniFinancialNotificationsEnabled($pdo, (int) $delivery['utilisateur_id']))) {
            $result = ['status' => -1, 'retryAfter' => ''];
        } else {
            $payload = json_encode(['title' => 'Moni', 'body' => 'Tu as une nouvelle notification.', 'route' => 'notifications'], JSON_THROW_ON_ERROR);
            $result = $transport->send($subscription, $payload);
        }
    } catch (Throwable $exception) {
        $result = ['status' => 0, 'retryAfter' => ''];
    }

    $statusCode = (int) $result['status'];
    $attempt = (int) $delivery['attempts'];
    $nextStatus = 'failed';
    $nextAttempt = null;
    $errorCode = null;
    $deactivate = false;
    if ($statusCode >= 200 && $statusCode < 300) {
        $nextStatus = 'accepted';
    } elseif (in_array($statusCode, [404, 410], true)) {
        $nextStatus = 'expired';
        $deactivate = true;
        $errorCode = 'endpoint_expired';
    } elseif ($statusCode === -1) {
        $nextStatus = 'cancelled';
        $errorCode = 'event_obsolete';
    } elseif (($statusCode === 0 || $statusCode === 429 || $statusCode >= 500) && $attempt < 5) {
        $candidate = moniDeliveryRetryTime($result, $attempt);
        $expires = $delivery['expires_at'] ?: $delivery['event_expires_at'];
        if ($expires === null || $candidate < new DateTimeImmutable($expires, new DateTimeZone('UTC'))) {
            $nextStatus = 'pending';
            $nextAttempt = $candidate->format('Y-m-d H:i:s.u');
        } else {
            $errorCode = 'retry_expired';
        }
    } else {
        $errorCode = $statusCode === 0 ? 'network_error' : 'provider_rejected';
    }

    $pdo->beginTransaction();
    try {
        $guard = $pdo->prepare("SELECT id FROM push_deliveries WHERE id = :id AND status = 'leased' AND lease_owner = :owner FOR UPDATE");
        $guard->execute(['id' => $delivery['id'], 'owner' => $owner]);
        if (!$guard->fetch()) { $pdo->rollBack(); return; }
        if ($deactivate) {
            $pdo->prepare("UPDATE push_devices SET active = 0, subscription_ciphertext = '', updated_at = UTC_TIMESTAMP(6) WHERE id = :id")->execute(['id' => $delivery['device_id']]);
            $pdo->prepare("UPDATE push_deliveries SET status = 'expired', last_status_code = :code, last_error_code = :error, lease_owner = NULL, lease_until = NULL, updated_at = UTC_TIMESTAMP(6) WHERE device_id = :device AND status IN ('pending', 'leased')")->execute(['code' => $statusCode, 'error' => $errorCode, 'device' => $delivery['device_id']]);
            $pdo->prepare("UPDATE notification_events e SET status = 'complete', updated_at = UTC_TIMESTAMP(6) WHERE status = 'queued' AND EXISTS (SELECT 1 FROM push_deliveries dx WHERE dx.event_id = e.id AND dx.device_id = :device) AND NOT EXISTS (SELECT 1 FROM push_deliveries dp WHERE dp.event_id = e.id AND dp.status IN ('pending', 'leased'))")->execute(['device' => $delivery['device_id']]);
        } else {
            $pdo->prepare('UPDATE push_deliveries SET status = :status, next_attempt_at = COALESCE(:next_attempt, next_attempt_at), last_status_code = :code, last_error_code = :error, lease_owner = NULL, lease_until = NULL, updated_at = UTC_TIMESTAMP(6) WHERE id = :id')->execute(['status' => $nextStatus, 'next_attempt' => $nextAttempt, 'code' => $statusCode ?: null, 'error' => $errorCode, 'id' => $delivery['id']]);
        }
        $pdo->prepare("UPDATE notification_events SET status = 'complete', updated_at = UTC_TIMESTAMP(6) WHERE id = :event AND status = 'queued' AND NOT EXISTS (SELECT 1 FROM push_deliveries d WHERE d.event_id = :event_check AND d.status IN ('pending', 'leased'))")->execute(['event' => $delivery['event_id'], 'event_check' => $delivery['event_id']]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
}

function moniRecoverPushRows(PDO $pdo, string $table, string $where, string $set): void
{
    if (!in_array($table, ['notification_events', 'push_deliveries'], true)) throw new InvalidArgumentException('Invalid push recovery table.');
    $pdo->beginTransaction();
    try {
        $rows = $pdo->query("SELECT id FROM {$table} WHERE {$where} ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED")->fetchAll(PDO::FETCH_COLUMN);
        if ($rows !== []) {
            $in = implode(',', array_fill(0, count($rows), '?'));
            $pdo->prepare("UPDATE {$table} SET {$set} WHERE id IN ({$in})")->execute(array_map('intval', $rows));
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
}

function moniRunPushWorker(PDO $pdo, MoniPushTransport $transport, bool $pushEnabled): array
{
    $workerId = moniPushWorkerId();
    moniRecoverPushRows($pdo, 'notification_events', "status IN ('pending','processing','queued') AND expires_at <= UTC_TIMESTAMP(6)", "status = 'cancelled', lease_owner = NULL, lease_until = NULL, updated_at = UTC_TIMESTAMP(6)");
    moniRecoverPushRows($pdo, 'push_deliveries', "status IN ('pending','leased') AND expires_at <= UTC_TIMESTAMP(6)", "status = 'expired', lease_owner = NULL, lease_until = NULL, updated_at = UTC_TIMESTAMP(6)");
    moniRecoverPushRows($pdo, 'notification_events', "status = 'processing' AND lease_until < UTC_TIMESTAMP(6)", "status = 'pending', lease_owner = NULL, lease_until = NULL");
    moniRecoverPushRows($pdo, 'push_deliveries', "status = 'leased' AND lease_until < UTC_TIMESTAMP(6)", "status = 'pending', lease_owner = NULL, lease_until = NULL, next_attempt_at = UTC_TIMESTAMP(6)");
    $events = moniClaimEvents($pdo, $workerId);
    foreach ($events as $event) moniProcessEvent($pdo, $event, $workerId, $pushEnabled);
    $deliveries = moniClaimDeliveries($pdo, $workerId);
    foreach ($deliveries as $delivery) moniProcessDelivery($pdo, $delivery, $workerId, $transport);
    return ['events' => count($events), 'deliveries' => count($deliveries)];
}
