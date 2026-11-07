<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('GET', 'POST', 'PATCH');
$method = $_SERVER['REQUEST_METHOD'];
$userId = moniRequireAuth($method !== 'GET');
$body = in_array($method, ['POST', 'PATCH'], true) ? moniBody() : [];

moniHandleDatabase(function () use ($pdo, $userId, $method, $body): void {
    if ($method === 'PATCH') {
        $key = moniText($body['id'] ?? null, 'notification', 191);
        $statement = $pdo->prepare('UPDATE notifications SET read_at = NOW() WHERE utilisateur_id = :user AND notification_key = :key');
        $statement->execute(['user' => $userId, 'key' => $key]);
        if ($statement->rowCount() !== 1) moniError('NOT_FOUND', 'Notification introuvable.', 404);
    } elseif ($method === 'POST') {
        if (!is_array($body['notifications'] ?? null) || count($body['notifications']) > 100) moniError('INVALID_NOTIFICATIONS', 'Liste de notifications invalide.', 422);
        $statement = $pdo->prepare('INSERT INTO notifications (utilisateur_id, notification_key, message) VALUES (:user, :key, :message) ON DUPLICATE KEY UPDATE message = VALUES(message)');
        foreach ($body['notifications'] as $item) {
            if (!is_array($item)) moniError('INVALID_NOTIFICATIONS', 'Notification invalide.', 422);
            $statement->execute(['user' => $userId, 'key' => moniText($item['id'] ?? null, 'notification', 191), 'message' => moniText($item['text'] ?? null, 'message', 500)]);
        }
    }
    $statement = $pdo->prepare('SELECT notification_key AS id, message AS text, (read_at IS NOT NULL) AS isRead FROM notifications WHERE utilisateur_id = :user ORDER BY created_at DESC, id DESC LIMIT 100');
    $statement->execute(['user' => $userId]);
    $items = array_map(static fn (array $item): array => ['id' => $item['id'], 'text' => $item['text'], 'read' => (bool) $item['isRead']], $statement->fetchAll());
    moniSuccess(['notifications' => $items]);
});
