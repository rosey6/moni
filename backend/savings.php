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
        moniSuccess(['state' => moniCurrentState($pdo, $userId)]);
    }
    if (($body['contribution'] ?? false) === true) {
        $goalId = moniId($body['goalId'] ?? $_GET['goalId'] ?? null, 'goal');
        $amount = moniAmount($body['amount'] ?? null, 'amount', false);
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
            $check = $pdo->prepare('SELECT id FROM objectifs_epargne WHERE id = :id AND utilisateur_id = :user FOR UPDATE');
            $check->execute(['id' => $goalId, 'user' => $userId]);
            if (!$check->fetch()) moniError('NOT_FOUND', 'Objectif introuvable.', 404);
            $before = moniSavingsTotal($pdo, $userId, $goalId);
            if ($method === 'PATCH') {
                $contributionId = moniId($body['id'] ?? $_GET['id'] ?? null, 'contribution');
                $statement = $pdo->prepare('UPDATE contributions_epargne SET montant = :amount WHERE id = :id AND objectif_id = :goal AND utilisateur_id = :user');
                $statement->execute(['amount' => $amount, 'id' => $contributionId, 'goal' => $goalId, 'user' => $userId]);
                if ($statement->rowCount() === 0) {
                    $check = $pdo->prepare('SELECT id FROM contributions_epargne WHERE id = :id AND objectif_id = :goal AND utilisateur_id = :user');
                    $check->execute(['id' => $contributionId, 'goal' => $goalId, 'user' => $userId]);
                    if (!$check->fetch()) moniError('NOT_FOUND', 'Contribution introuvable.', 404);
                }
            } elseif ($method === 'DELETE') {
                $contributionId = moniId($body['id'] ?? $_GET['id'] ?? null, 'contribution');
                $statement = $pdo->prepare('DELETE FROM contributions_epargne WHERE id = :id AND objectif_id = :goal AND utilisateur_id = :user');
                $statement->execute(['id' => $contributionId, 'goal' => $goalId, 'user' => $userId]);
                if ($statement->rowCount() !== 1) moniError('NOT_FOUND', 'Contribution introuvable.', 404);
            } else {
                $statement = $pdo->prepare('INSERT INTO contributions_epargne (objectif_id, utilisateur_id, montant) VALUES (:goal, :user, :amount)');
                $statement->execute(['goal' => $goalId, 'user' => $userId, 'amount' => $amount]);
            }
            moniEmitSavingsCrossing($pdo, $userId, $goalId, $before, moniSavingsTotal($pdo, $userId, $goalId));
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
        moniSuccess(['state' => moniCurrentState($pdo, $userId)], $method === 'POST' ? 201 : 200);
    }

    if ($method === 'DELETE') {
        $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'goal');
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
            $statement = $pdo->prepare('DELETE FROM objectifs_epargne WHERE id = :id AND utilisateur_id = :user');
            $statement->execute(['id' => $id, 'user' => $userId]);
            if ($statement->rowCount() !== 1) moniError('NOT_FOUND', 'Objectif introuvable.', 404);
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
        moniSuccess(['state' => moniCurrentState($pdo, $userId)], 200);
    }

    $name = moniText($body['name'] ?? null, 'name', 80);
    $mode = ($body['mode'] ?? 'goal') === 'free' ? 'free' : 'goal';
    $target = $mode === 'free' ? null : moniAmount($body['target'] ?? null, 'target', false);
    $dateValue = $body['date'] ?? null;
    $date = $mode === 'free' || $dateValue === null || $dateValue === '' ? null : moniDate($dateValue, 'date', true);
    if ($method === 'PATCH' || $method === 'PUT') {
        $id = moniId($body['id'] ?? $_GET['id'] ?? null, 'goal');
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
            $statement = $pdo->prepare('UPDATE objectifs_epargne SET nom = :name, mode = :mode, montant_cible = :target, date_cible = :date WHERE id = :id AND utilisateur_id = :user');
            $statement->execute(['name' => $name, 'mode' => $mode, 'target' => $target, 'date' => $date, 'id' => $id, 'user' => $userId]);
            if ($statement->rowCount() === 0) {
                $check = $pdo->prepare('SELECT id FROM objectifs_epargne WHERE id = :id AND utilisateur_id = :user');
                $check->execute(['id' => $id, 'user' => $userId]);
                if (!$check->fetch()) moniError('NOT_FOUND', 'Objectif introuvable.', 404);
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    } else {
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
            $statement = $pdo->prepare('INSERT INTO objectifs_epargne (utilisateur_id, nom, mode, montant_cible, date_cible) VALUES (:user, :name, :mode, :target, :date)');
            $statement->execute(['user' => $userId, 'name' => $name, 'mode' => $mode, 'target' => $target, 'date' => $date]);
            $goalId = (int) $pdo->lastInsertId();
            if (isset($body['initial']) && moniAmount($body['initial'], 'initial') > 0) {
                $initial = moniAmount($body['initial'], 'initial');
                $contribution = $pdo->prepare('INSERT INTO contributions_epargne (objectif_id, utilisateur_id, montant) VALUES (:goal, :user, :amount)');
                $contribution->execute(['goal' => $goalId, 'user' => $userId, 'amount' => $initial]);
                moniEmitSavingsCrossing($pdo, $userId, $goalId, 0, $initial);
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    }
    moniSuccess(['state' => moniCurrentState($pdo, $userId)], $method === 'POST' ? 201 : 200);
});
