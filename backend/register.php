<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/privacy_policy.php';
require_once __DIR__ . '/lib/notification_events.php';

moniMethod('POST');
$body = moniBody();
if (($body['privacyAccepted'] ?? null) !== true) moniError('PRIVACY_CONSENT_REQUIRED', 'Accepte la politique de confidentialité pour créer ton compte.', 422);
$policy = moniApprovedPrivacyPolicy();
if (!$policy) moniError('PRIVACY_POLICY_UNAVAILABLE', 'La politique de confidentialité n’est pas encore disponible.', 503);
if (($body['privacyPolicyVersion'] ?? null) !== $policy['version']) moniError('PRIVACY_POLICY_CHANGED', 'La politique a changé. Consulte-la et accepte la version actuelle.', 409);

$name = moniText($body['name'] ?? $body['nom'] ?? null, 'name', 80);
$email = moniEmail($body['email'] ?? null);
$password = moniPassword($body['password'] ?? $body['mot_de_passe'] ?? null);
$currency = moniIsoCurrency($body['currency'] ?? 'XOF');

moniHandleDatabase(function () use ($pdo, $name, $email, $password, $currency, $policy): void {
    try {
        $statement = $pdo->prepare('INSERT INTO utilisateurs (nom, email, `mot de passe`, solde_initial, devise, budget_mensuel, langue, preferences_json, privacy_policy_version, privacy_accepted_at) VALUES (:name, :email, :password, 0, :currency, 0, \'fr\', :preferences, :policy_version, UTC_TIMESTAMP(6))');
        $statement->execute([
            'name' => $name,
            'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'currency' => $currency,
            'policy_version' => $policy['version'],
            'preferences' => json_encode(['alerts' => ['budget' => true, 'subscriptions' => true, 'savings' => true]], JSON_THROW_ON_ERROR),
        ]);
    } catch (PDOException $exception) {
        if ($exception->getCode() === '23000') {
            moniError('EMAIL_EXISTS', 'Cette adresse e-mail est déjà utilisée.', 409);
        }
        throw $exception;
    }

    $userId = (int) $pdo->lastInsertId();
    try {
        $pdo->beginTransaction();
        moniEmitNotification($pdo, $userId, 'security:welcome', 'security', 'Bienvenue sur Moni', 'Ton compte est prêt. Les notifications importantes apparaîtront ici.', 'dashboard', null, null, true);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[moni] welcome notification creation failed: ' . $exception->getMessage());
    }
    $acceptedAt = $pdo->prepare('SELECT privacy_accepted_at FROM utilisateurs WHERE id = :id');
    $acceptedAt->execute(['id' => $userId]);
    $privacyAcceptedAt = $acceptedAt->fetchColumn();
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['session_version'] = 1;
    $_SESSION['authenticated_at'] = $_SESSION['last_activity_at'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    moniSuccess(['user' => ['id' => $_SESSION['user_id'], 'name' => $name, 'email' => $email], 'privacyConsent' => ['version' => $policy['version'], 'acceptedAt' => $privacyAcceptedAt], 'csrfToken' => $_SESSION['csrf_token']], 201);
});
