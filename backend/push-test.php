<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/push_config.php';

moniMethod('POST');
$userId = moniRequireAuth(true);
if (!moniPushAvailable()) {
    moniError('PUSH_UNAVAILABLE', 'Les notifications push ne sont pas activées.', 503);
}

moniHandleDatabase(function () use ($pdo, $userId): void {
    $pdo->beginTransaction();
    try {
        $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
        $devices = $pdo->prepare('SELECT COUNT(*) FROM push_devices WHERE utilisateur_id = :user AND active = 1 FOR UPDATE');
        $devices->execute(['user' => $userId]);
        if ((int) $devices->fetchColumn() === 0) moniError('PUSH_NOT_SUBSCRIBED', 'Active les notifications push sur cet appareil avant le test.', 409);
        $recent = $pdo->prepare("SELECT COUNT(*) FROM notification_events WHERE utilisateur_id = :user AND event_key LIKE 'push-test:%' AND created_at >= UTC_TIMESTAMP(6) - INTERVAL 1 HOUR");
        $recent->execute(['user' => $userId]);
        if ((int) $recent->fetchColumn() >= 3) moniError('RATE_LIMITED', 'Limite de tests atteinte. Réessaie plus tard.', 429);
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $statement = $pdo->prepare("INSERT INTO notification_events (utilisateur_id, event_key, event_type, destination, payload_json, due_at, next_attempt_at, expires_at, status, created_at, updated_at) VALUES (:user, :key, 'security', 'notifications', :payload, :due_at, :next_attempt_at, :expires_at, 'pending', :created_at, :updated_at)");
        $timestamp = $now->format('Y-m-d H:i:s.u');
        $statement->execute([
            'user' => $userId,
            'key' => 'push-test:' . bin2hex(random_bytes(16)),
            'payload' => json_encode(['title' => 'Moni', 'body' => 'Tu as une nouvelle notification.', 'route' => 'notifications'], JSON_THROW_ON_ERROR),
            'due_at' => $timestamp,
            'next_attempt_at' => $timestamp,
            'expires_at' => $now->modify('+1 hour')->format('Y-m-d H:i:s.u'),
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    moniSuccess(['queued' => true], 202);
});
