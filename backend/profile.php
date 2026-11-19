<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/notification_events.php';

moniMethod('PATCH', 'PUT');
$userId = moniRequireAuth(true);
$body = moniBody();
$fields = [];
$params = ['user' => $userId];
$alerts = null;
if (array_key_exists('name', $body) || array_key_exists('nom', $body)) {
    $fields[] = 'nom = :name';
    $params['name'] = moniText($body['name'] ?? $body['nom'], 'name', 80);
}
if (array_key_exists('email', $body)) {
    $fields[] = 'email = :email';
    $params['email'] = moniEmail($body['email']);
}
if (array_key_exists('currency', $body)) {
    $fields[] = 'devise = :currency';
    $params['currency'] = moniIsoCurrency($body['currency']);
}
if (array_key_exists('language', $body)) {
    $language = is_string($body['language']) ? strtolower($body['language']) : '';
    if (!in_array($language, ['fr', 'en'], true)) moniError('INVALID_LANGUAGE', 'Langue non prise en charge.', 422);
    $fields[] = 'langue = :language';
    $params['language'] = $language;
}
if (array_key_exists('alerts', $body)) {
    if (!is_array($body['alerts'])) moniError('INVALID_ALERTS', 'Préférences d’alerte invalides.', 422);
    $alerts = [];
    foreach (['budget', 'subscriptions', 'savings'] as $key) $alerts[$key] = (bool) ($body['alerts'][$key] ?? false);
    $fields[] = 'preferences_json = :preferences';
}
if ($fields === []) moniError('EMPTY_UPDATE', 'Aucune donnée à modifier.', 422);

moniHandleDatabase(function () use ($pdo, $fields, $params, $userId, $alerts): void {
    $pdo->beginTransaction();
    try {
    $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
    $oldEmail = null;
    if (array_key_exists('email', $params)) {
        $currentEmail = $pdo->prepare('SELECT email FROM utilisateurs WHERE id = :user');
        $currentEmail->execute(['user' => $userId]);
        $oldEmail = (string) $currentEmail->fetchColumn();
    }
    if ($alerts !== null) {
        $current = $pdo->prepare('SELECT preferences_json FROM utilisateurs WHERE id = :user LIMIT 1');
        $current->execute(['user' => $userId]);
        $preferences = json_decode((string) $current->fetchColumn(), true);
        if (!is_array($preferences)) $preferences = [];
        $preferences['alerts'] = $alerts;
        $params['preferences'] = json_encode($preferences, JSON_THROW_ON_ERROR);
    }
    if (array_key_exists('currency', $params)) {
        $current = $pdo->prepare('SELECT devise FROM utilisateurs WHERE id = :user');
        $current->execute(['user' => $userId]);
        $currentCurrency = $current->fetchColumn();
        $count = $pdo->prepare('SELECT (SELECT COUNT(*) FROM budgets WHERE utilisateur_id = :user1) + (SELECT COUNT(*) FROM transactions WHERE utilisateur_id = :user2) + (SELECT COUNT(*) FROM abonnements WHERE utilisateur_id = :user3) + (SELECT COUNT(*) FROM objectifs_epargne WHERE utilisateur_id = :user4) + (SELECT COUNT(*) FROM utilisateurs WHERE id = :user5 AND solde_initial > 0)');
        $count->execute(['user1' => $userId, 'user2' => $userId, 'user3' => $userId, 'user4' => $userId, 'user5' => $userId]);
        if ($currentCurrency !== $params['currency'] && (int) $count->fetchColumn() > 0) {
            moniError('CURRENCY_CHANGE_REQUIRES_MIGRATION', 'La devise ne peut pas changer après saisie de données financières sans migration explicite.', 409);
        }
    }
    try {
        $pdo->prepare('UPDATE utilisateurs SET ' . implode(', ', $fields) . ' WHERE id = :user')->execute($params);
    } catch (PDOException $exception) {
        if ($exception->getCode() === '23000') moniError('EMAIL_EXISTS', 'Cette adresse e-mail est déjà utilisée.', 409);
        throw $exception;
    }
    if ($oldEmail !== null && strcasecmp($oldEmail, (string) $params['email']) !== 0) {
        moniEmitNotification($pdo, $userId, 'security:email:' . bin2hex(random_bytes(16)), 'security', 'Adresse e-mail modifiée', 'L’adresse e-mail de ton compte Moni a été modifiée.', 'profile', null, null, true);
    }
    $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    moniSuccess(['state' => moniCurrentState($pdo, $userId)]);
});
