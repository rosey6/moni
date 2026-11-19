<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('GET', 'POST', 'PATCH');
$method = $_SERVER['REQUEST_METHOD'];
$userId = moniRequireAuth($method !== 'GET');
$body = in_array($method, ['POST', 'PATCH'], true) ? moniBody() : [];

moniHandleDatabase(function () use ($pdo, $userId, $method, $body): void {
    $pdo->exec("SET time_zone = '+00:00'");
    if ($method === 'PATCH') {
        if (($body['action'] ?? null) === 'read_all') {
            $statement = $pdo->prepare('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE utilisateur_id = :user AND read_at IS NULL');
            $statement->execute(['user' => $userId]);
        } else {
            $key = moniText($body['id'] ?? null, 'notification', 191);
            $statement = $pdo->prepare('UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE utilisateur_id = :user AND notification_key = :key');
            $statement->execute(['user' => $userId, 'key' => $key]);
            if ($statement->rowCount() === 0) {
                $check = $pdo->prepare('SELECT 1 FROM notifications WHERE utilisateur_id = :user AND notification_key = :key');
                $check->execute(['user' => $userId, 'key' => $key]);
                if (!$check->fetch()) moniError('NOT_FOUND', 'Notification introuvable.', 404);
            }
        }
    } elseif ($method === 'POST') {
        if (!is_array($body['notifications'] ?? null) || count($body['notifications']) > 100) moniError('INVALID_NOTIFICATIONS', 'Liste de notifications invalide.', 422);
        $statement = $pdo->prepare('INSERT INTO notifications (utilisateur_id, notification_key, message) VALUES (:user, :key, :message) ON DUPLICATE KEY UPDATE message = VALUES(message)');
        foreach ($body['notifications'] as $item) {
            if (!is_array($item)) moniError('INVALID_NOTIFICATIONS', 'Notification invalide.', 422);
            $statement->execute(['user' => $userId, 'key' => moniText($item['id'] ?? null, 'notification', 191), 'message' => moniText($item['text'] ?? null, 'message', 500)]);
        }
    }
    $limit = filter_var($_GET['limit'] ?? 100, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]);
    if ($limit === false) moniError('INVALID_LIMIT', 'Limite invalide.', 422);
    $filter = $_GET['filter'] ?? 'all';
    if (!in_array($filter, ['all', 'unread'], true)) moniError('INVALID_FILTER', 'Filtre invalide.', 422);
    $cursor = null;
    if (isset($_GET['cursor'])) {
        $raw = (string) $_GET['cursor'];
        if (strlen($raw) > 160 || !preg_match('/^[A-Za-z0-9_-]+$/', $raw)) moniError('INVALID_CURSOR', 'Curseur invalide.', 422);
        $decoded = base64_decode(strtr($raw, '-_', '+/'), true);
        $cursor = $decoded === false ? null : json_decode($decoded, true);
        if (!is_array($cursor) || !isset($cursor['created'], $cursor['id']) || !is_string($cursor['created']) || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $cursor['created']) || !is_int($cursor['id']) || $cursor['id'] < 1) moniError('INVALID_CURSOR', 'Curseur invalide.', 422);
    }
    $where = 'utilisateur_id = :user' . ($filter === 'unread' ? ' AND read_at IS NULL' : '');
    if ($cursor) $where .= ' AND (created_at < :created_before OR (created_at = :created_equal AND id < :cursor_id))';
    $statement = $pdo->prepare("SELECT id AS rowId, notification_key AS id, event_type AS type, title, message AS text, destination, resource_type AS resourceType, resource_id AS resourceId, (read_at IS NOT NULL) AS isRead, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created FROM notifications WHERE $where ORDER BY created_at DESC, id DESC LIMIT :max_rows");
    $statement->bindValue(':user', $userId, PDO::PARAM_INT);
    $statement->bindValue(':max_rows', $limit + 1, PDO::PARAM_INT);
    if ($cursor) {
        $statement->bindValue(':created_before', $cursor['created']);
        $statement->bindValue(':created_equal', $cursor['created']);
        $statement->bindValue(':cursor_id', $cursor['id'], PDO::PARAM_INT);
    }
    $statement->execute();
    $rows = $statement->fetchAll();
    $hasMore = count($rows) > $limit;
    if ($hasMore) array_pop($rows);
    $nextCursor = null;
    if ($hasMore && $rows) {
        $last = end($rows);
        $nextCursor = rtrim(strtr(base64_encode(json_encode(['created' => $last['created'], 'id' => (int) $last['rowId']], JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    }
    $types = ['budget', 'subscription', 'savings', 'monthly', 'security'];
    $destinations = ['dashboard', 'budgets', 'subscriptions-manage', 'savings', 'profile', 'notifications'];
    $resources = ['budget', 'subscription', 'goal', 'transaction'];
    $items = array_map(static function (array $item) use ($types, $destinations, $resources): array {
        $type = in_array($item['type'], $types, true) ? $item['type'] : null;
        $destination = in_array($item['destination'], $destinations, true) ? $item['destination'] : null;
        $resourceType = in_array($item['resourceType'], $resources, true) ? $item['resourceType'] : null;
        return [
            'id' => $item['id'],
            'type' => $type,
            'title' => is_string($item['title']) && $item['title'] !== '' ? $item['title'] : null,
            'text' => $item['text'],
            'read' => (bool) $item['isRead'],
            'createdAt' => str_replace(' ', 'T', $item['created']) . 'Z',
            'destination' => $destination,
            'resourceType' => $resourceType,
            'resourceId' => $item['resourceId'] === null ? null : (int) $item['resourceId'],
        ];
    }, $rows);
    $count = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE utilisateur_id = :user AND read_at IS NULL');
    $count->execute(['user' => $userId]);
    moniSuccess(['notifications' => $items, 'nextCursor' => $nextCursor, 'unreadCount' => (int) $count->fetchColumn()]);
});
