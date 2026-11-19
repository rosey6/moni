<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/notification_events.php';

moniMethod('GET', 'POST', 'PATCH', 'PUT', 'DELETE');
$method = $_SERVER['REQUEST_METHOD'];
$userId = moniRequireAuth($method !== 'GET');
$body = in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'], true) ? moniBody() : [];

moniHandleDatabase(function () use ($pdo, $userId, $method, $body): void {
    if ($method === 'GET') {
        $statement = $pdo->prepare('SELECT t.id, t.type, t.montant AS amount, c.slug AS category, DATE_FORMAT(t.date_operation, \'%Y-%m-%d\') AS date, t.description FROM transactions t INNER JOIN categories c ON c.id = t.categorie_id WHERE t.utilisateur_id = :user ORDER BY t.date_operation DESC, t.id DESC');
        $statement->execute(['user' => $userId]);
        $items = array_map(static function (array $item): array { $item['id'] = (int) $item['id']; $item['amount'] = (int) $item['amount']; return $item; }, $statement->fetchAll());
        moniSuccess(['transactions' => $items]);
    }

    if ($method === 'DELETE') {
        $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'transaction');
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
            $beforeRow = $pdo->prepare('SELECT t.type, c.slug AS category, DATE_FORMAT(t.date_operation, \'%Y-%m-%d\') AS date FROM transactions t INNER JOIN categories c ON c.id = t.categorie_id WHERE t.id = :id AND t.utilisateur_id = :user FOR UPDATE');
            $beforeRow->execute(['id' => $id, 'user' => $userId]);
            $old = $beforeRow->fetch();
            if (!$old) moniError('NOT_FOUND', 'Transaction introuvable.', 404);
            $before = $old['type'] === 'expense' ? moniBudgetSnapshot($pdo, $userId, $old['category'], $old['date']) : null;
            $pdo->prepare('DELETE FROM transactions WHERE id = :id AND utilisateur_id = :user')->execute(['id' => $id, 'user' => $userId]);
            if ($before !== null) {
                $after = moniBudgetSnapshot($pdo, $userId, $old['category'], $old['date']);
                moniEmitBudgetCrossing($pdo, $userId, $old['category'], substr($old['date'], 0, 7), $before, $after);
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
        moniSuccess(['deleted' => true], 200);
    }

    $type = $body['type'] ?? null;
    if (!in_array($type, ['expense', 'income'], true)) moniError('INVALID_TYPE', 'Type de transaction invalide.', 422);
    $amount = moniAmount($body['amount'] ?? null, 'amount', false);
    $category = moniCategorySlug($pdo, $body['category'] ?? null, $type);
    $date = moniDate($body['date'] ?? null);
    $description = moniText($body['description'] ?? '', 'description', 200, false);
    $categoryStatement = $pdo->prepare('SELECT id FROM categories WHERE slug = :slug LIMIT 1');
    $categoryStatement->execute(['slug' => $category]);
    $categoryId = $categoryStatement->fetchColumn();
    if ($categoryId === false) moniError('INVALID_CATEGORY', 'Catégorie invalide.', 422);

    $pdo->beginTransaction();
    try {
        $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
        $buckets = [];
        $id = null;
        if ($method === 'PATCH' || $method === 'PUT') {
            $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'transaction');
            $oldStatement = $pdo->prepare('SELECT t.type, c.slug AS category, DATE_FORMAT(t.date_operation, \'%Y-%m-%d\') AS date FROM transactions t INNER JOIN categories c ON c.id = t.categorie_id WHERE t.id = :id AND t.utilisateur_id = :user FOR UPDATE');
            $oldStatement->execute(['id' => $id, 'user' => $userId]);
            $old = $oldStatement->fetch();
            if (!$old) moniError('NOT_FOUND', 'Transaction introuvable.', 404);
            if ($old['type'] === 'expense') $buckets[$old['category'] . '|' . $old['date']] = moniBudgetSnapshot($pdo, $userId, $old['category'], $old['date']);
            if ($type === 'expense') {
                $bucketKey = $category . '|' . $date;
                if (!array_key_exists($bucketKey, $buckets)) $buckets[$bucketKey] = moniBudgetSnapshot($pdo, $userId, $category, $date);
            }
            $statement = $pdo->prepare('UPDATE transactions SET type = :type, montant = :amount, categorie_id = :category, date_operation = :date, description = :description WHERE id = :id AND utilisateur_id = :user');
            $statement->execute(['type' => $type, 'amount' => $amount, 'category' => $categoryId, 'date' => $date, 'description' => $description ?: null, 'id' => $id, 'user' => $userId]);
        } else {
            if ($type === 'expense') $buckets[$category . '|' . $date] = moniBudgetSnapshot($pdo, $userId, $category, $date);
            $statement = $pdo->prepare('INSERT INTO transactions (utilisateur_id, type, montant, categorie_id, date_operation, description) VALUES (:user, :type, :amount, :category, :date, :description)');
            $statement->execute(['user' => $userId, 'type' => $type, 'amount' => $amount, 'category' => $categoryId, 'date' => $date, 'description' => $description ?: null]);
        }
        foreach ($buckets as $bucket => $before) {
            [$bucketCategory, $bucketDate] = explode('|', $bucket, 2);
            $after = moniBudgetSnapshot($pdo, $userId, $bucketCategory, $bucketDate);
            moniEmitBudgetCrossing($pdo, $userId, $bucketCategory, substr($bucketDate, 0, 7), $before, $after);
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    moniSuccess(['state' => moniCurrentState($pdo, $userId)], $method === 'POST' ? 201 : 200);
});
