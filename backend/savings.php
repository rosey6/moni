<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('GET', 'POST', 'PATCH', 'PUT', 'DELETE');
$method = $_SERVER['REQUEST_METHOD'];
$userId = moniRequireAuth($method !== 'GET');
$body = in_array($method, ['POST', 'PATCH', 'PUT', 'DELETE'], true) ? moniBody() : [];

moniHandleDatabase(function () use ($pdo, $userId, $method, $body): void {
    if ($method === 'GET') {
        moniSuccess(['state' => moniCurrentState($pdo, $userId)]);
    }
    if (($body['contribution'] ?? false) === true) {
        $goalId = moniId($body['goalId'] ?? $_GET['goalId'] ?? null, 'goal');
        $amount = moniAmount($body['amount'] ?? null, 'amount', false);
        $check = $pdo->prepare('SELECT id FROM objectifs_epargne WHERE id = :id AND utilisateur_id = :user');
        $check->execute(['id' => $goalId, 'user' => $userId]);
        if (!$check->fetch()) moniError('NOT_FOUND', 'Objectif introuvable.', 404);
        if ($method === 'PATCH') {
            $contributionId = moniId($body['id'] ?? $_GET['id'] ?? null, 'contribution');
            $statement = $pdo->prepare('UPDATE contributions_epargne SET montant = :amount WHERE id = :id AND objectif_id = :goal AND utilisateur_id = :user');
            $statement->execute(['amount' => $amount, 'id' => $contributionId, 'goal' => $goalId, 'user' => $userId]);
            if ($statement->rowCount() !== 1) moniError('NOT_FOUND', 'Contribution introuvable.', 404);
        } elseif ($method === 'DELETE') {
            $contributionId = moniId($body['id'] ?? $_GET['id'] ?? null, 'contribution');
            $statement = $pdo->prepare('DELETE FROM contributions_epargne WHERE id = :id AND objectif_id = :goal AND utilisateur_id = :user');
            $statement->execute(['id' => $contributionId, 'goal' => $goalId, 'user' => $userId]);
            if ($statement->rowCount() !== 1) moniError('NOT_FOUND', 'Contribution introuvable.', 404);
        } else {
            $statement = $pdo->prepare('INSERT INTO contributions_epargne (objectif_id, utilisateur_id, montant) VALUES (:goal, :user, :amount)');
            $statement->execute(['goal' => $goalId, 'user' => $userId, 'amount' => $amount]);
        }
        moniSuccess(['state' => moniCurrentState($pdo, $userId)], $method === 'POST' ? 201 : 200);
    }

    if ($method === 'DELETE') {
        $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'goal');
        $statement = $pdo->prepare('DELETE FROM objectifs_epargne WHERE id = :id AND utilisateur_id = :user');
        $statement->execute(['id' => $id, 'user' => $userId]);
        if ($statement->rowCount() !== 1) moniError('NOT_FOUND', 'Objectif introuvable.', 404);
        moniSuccess(['state' => moniCurrentState($pdo, $userId)], 200);
    }

    $name = moniText($body['name'] ?? null, 'name', 80);
    $target = moniAmount($body['target'] ?? null, 'target', false);
    $date = moniDate($body['date'] ?? null, 'date', true);
    if ($method === 'PATCH' || $method === 'PUT') {
        $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'goal');
        $statement = $pdo->prepare('UPDATE objectifs_epargne SET nom = :name, montant_cible = :target, date_cible = :date WHERE id = :id AND utilisateur_id = :user');
        $statement->execute(['name' => $name, 'target' => $target, 'date' => $date, 'id' => $id, 'user' => $userId]);
        if ($statement->rowCount() === 0) {
            $check = $pdo->prepare('SELECT id FROM objectifs_epargne WHERE id = :id AND utilisateur_id = :user');
            $check->execute(['id' => $id, 'user' => $userId]);
            if (!$check->fetch()) moniError('NOT_FOUND', 'Objectif introuvable.', 404);
        }
    } else {
        $pdo->beginTransaction();
        try {
            $statement = $pdo->prepare('INSERT INTO objectifs_epargne (utilisateur_id, nom, montant_cible, date_cible) VALUES (:user, :name, :target, :date)');
            $statement->execute(['user' => $userId, 'name' => $name, 'target' => $target, 'date' => $date]);
            $goalId = (int) $pdo->lastInsertId();
            if (isset($body['initial']) && moniAmount($body['initial'], 'initial') > 0) {
                $contribution = $pdo->prepare('INSERT INTO contributions_epargne (objectif_id, utilisateur_id, montant) VALUES (:goal, :user, :amount)');
                $contribution->execute(['goal' => $goalId, 'user' => $userId, 'amount' => moniAmount($body['initial'], 'initial')]);
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    }
    moniSuccess(['state' => moniCurrentState($pdo, $userId)], $method === 'POST' ? 201 : 200);
});
