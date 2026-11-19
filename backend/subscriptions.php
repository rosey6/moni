<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('GET', 'POST', 'PATCH', 'PUT', 'DELETE');
$method = $_SERVER['REQUEST_METHOD'];
$userId = moniRequireAuth($method !== 'GET');
$body = in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'], true) ? moniBody() : [];

moniHandleDatabase(function () use ($pdo, $userId, $method, $body): void {
    if ($method === 'GET') {
        $statement = $pdo->prepare('SELECT a.id, a.nom AS name, a.montant_mensuel AS amount, a.jour_facturation AS billingDay, c.slug AS includedIn FROM abonnements a LEFT JOIN categories c ON c.id = a.categorie_id WHERE a.utilisateur_id = :user ORDER BY a.nom');
        $statement->execute(['user' => $userId]);
        $items = array_map(static function (array $item): array { $item['id'] = (int) $item['id']; $item['amount'] = (int) $item['amount']; $item['billingDay'] = (int) $item['billingDay']; return $item; }, $statement->fetchAll());
        moniSuccess(['subscriptions' => $items]);
    }

    if ($method === 'DELETE') {
        $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'subscription');
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
            $statement = $pdo->prepare('DELETE FROM abonnements WHERE id = :id AND utilisateur_id = :user');
            $statement->execute(['id' => $id, 'user' => $userId]);
            if ($statement->rowCount() !== 1) moniError('NOT_FOUND', 'Abonnement introuvable.', 404);
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
        moniSuccess(['deleted' => true, 'state' => moniCurrentState($pdo, $userId)], 200);
    }

    $name = moniText($body['name'] ?? null, 'name', 80);
    $amount = moniAmount($body['amount'] ?? null, 'amount');
    $billingDay = filter_var($body['billingDay'] ?? null, FILTER_VALIDATE_INT);
    if ($billingDay === false || $billingDay < 1 || $billingDay > 31) moniError('INVALID_BILLING_DAY', 'Jour de facturation invalide.', 422);
    $includedIn = $body['includedIn'] ?? null;
    $categoryId = null;
    if ($includedIn !== null && $includedIn !== '') {
        $includedIn = moniCategorySlug($pdo, $includedIn);
        $categoryStatement = $pdo->prepare('SELECT id FROM categories WHERE slug = :slug LIMIT 1');
        $categoryStatement->execute(['slug' => $includedIn]);
        $categoryId = $categoryStatement->fetchColumn();
        if ($categoryId === false) moniError('INVALID_CATEGORY', 'Allocation invalide.', 422);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
        if ($method === 'PATCH' || $method === 'PUT') {
            $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'subscription');
            $statement = $pdo->prepare('UPDATE abonnements SET nom = :name, montant_mensuel = :amount, jour_facturation = :day, categorie_id = :category WHERE id = :id AND utilisateur_id = :user');
            $statement->execute(['name' => $name, 'amount' => $amount, 'day' => $billingDay, 'category' => $categoryId, 'id' => $id, 'user' => $userId]);
            if ($statement->rowCount() === 0) {
                $check = $pdo->prepare('SELECT id FROM abonnements WHERE id = :id AND utilisateur_id = :user');
                $check->execute(['id' => $id, 'user' => $userId]);
                if (!$check->fetch()) moniError('NOT_FOUND', 'Abonnement introuvable.', 404);
            }
        } else {
            $statement = $pdo->prepare('INSERT INTO abonnements (utilisateur_id, nom, montant_mensuel, jour_facturation, categorie_id) VALUES (:user, :name, :amount, :day, :category)');
            $statement->execute(['user' => $userId, 'name' => $name, 'amount' => $amount, 'day' => $billingDay, 'category' => $categoryId]);
        }
        $pdo->commit();
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($exception->getCode() === '23000') moniError('DUPLICATE_SUBSCRIPTION', 'Cet abonnement existe déjà.', 409);
        throw $exception;
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    moniSuccess(['state' => moniCurrentState($pdo, $userId)], $method === 'POST' ? 201 : 200);
});
