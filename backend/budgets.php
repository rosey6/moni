<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('GET', 'POST', 'PATCH', 'PUT', 'DELETE');
$method = $_SERVER['REQUEST_METHOD'];
$userId = moniRequireAuth($method !== 'GET');
$body = in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'], true) ? moniBody() : [];

moniHandleDatabase(function () use ($pdo, $userId, $method, $body): void {
    if ($method === 'GET') {
        $month = (int) ($_GET['month'] ?? date('m'));
        $year = (int) ($_GET['year'] ?? date('Y'));
        if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) moniError('INVALID_PERIOD', 'Période invalide.', 422);
        $statement = $pdo->prepare('SELECT b.id, c.slug AS category, b.montant_limite AS `limit`, b.mois AS month, b.annee AS year FROM budgets b INNER JOIN categories c ON c.id = b.categorie_id WHERE b.utilisateur_id = :user AND b.mois = :month AND b.annee = :year ORDER BY c.id');
        $statement->execute(['user' => $userId, 'month' => $month, 'year' => $year]);
        $items = array_map(static function (array $item): array { $item['id'] = (int) $item['id']; $item['limit'] = (int) $item['limit']; $item['month'] = (int) $item['month']; $item['year'] = (int) $item['year']; return $item; }, $statement->fetchAll());
        moniSuccess(['budgets' => $items]);
    }

    if ($method === 'DELETE') {
        $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'budget');
        $statement = $pdo->prepare('DELETE FROM budgets WHERE id = :id AND utilisateur_id = :user');
        $statement->execute(['id' => $id, 'user' => $userId]);
        if ($statement->rowCount() !== 1) moniError('NOT_FOUND', 'Budget introuvable.', 404);
        moniSuccess(['deleted' => true], 200);
    }

    $categoryValue = $body['category'] ?? $body['categorie'] ?? null;
    if ($categoryValue === null && array_key_exists('categorie_id', $body)) {
        $legacyCategory = $pdo->prepare('SELECT slug FROM categories WHERE id = :id LIMIT 1');
        $legacyCategory->execute(['id' => moniId($body['categorie_id'], 'category')]);
        $categoryValue = $legacyCategory->fetchColumn();
    }
    $category = moniCategorySlug($pdo, $categoryValue);
    $amount = moniAmount($body['limit'] ?? $body['montant_limite'] ?? null, 'limit');
    $month = (int) ($body['month'] ?? $body['mois'] ?? date('m'));
    $year = (int) ($body['year'] ?? $body['annee'] ?? date('Y'));
    if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) moniError('INVALID_PERIOD', 'Période invalide.', 422);
    $categoryStatement = $pdo->prepare('SELECT id FROM categories WHERE slug = :slug LIMIT 1');
    $categoryStatement->execute(['slug' => $category]);
    $categoryId = $categoryStatement->fetchColumn();
    if ($categoryId === false) moniError('INVALID_CATEGORY', 'Catégorie invalide.', 422);

    if ($method === 'PATCH' || $method === 'PUT') {
        $id = moniId($body['id'] ?? $body['budget_id'] ?? $_GET['id'] ?? null, 'budget');
        $statement = $pdo->prepare('UPDATE budgets SET categorie_id = :category, montant_limite = :amount, mois = :month, annee = :year WHERE id = :id AND utilisateur_id = :user');
        $statement->execute(['category' => $categoryId, 'amount' => $amount, 'month' => $month, 'year' => $year, 'id' => $id, 'user' => $userId]);
        if ($statement->rowCount() === 0) {
            $check = $pdo->prepare('SELECT id FROM budgets WHERE id = :id AND utilisateur_id = :user');
            $check->execute(['id' => $id, 'user' => $userId]);
            if (!$check->fetch()) moniError('NOT_FOUND', 'Budget introuvable.', 404);
        }
    } else {
        $statement = $pdo->prepare('INSERT INTO budgets (utilisateur_id, categorie_id, montant_limite, mois, annee) VALUES (:user, :category, :amount, :month, :year) ON DUPLICATE KEY UPDATE montant_limite = VALUES(montant_limite)');
        $statement->execute(['user' => $userId, 'category' => $categoryId, 'amount' => $amount, 'month' => $month, 'year' => $year]);
    }
    moniSuccess(['state' => moniCurrentState($pdo, $userId)], $method === 'POST' ? 201 : 200);
});
