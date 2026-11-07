<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('POST');
$body = moniBody();
$name = moniText($body['name'] ?? $body['nom'] ?? null, 'name', 80);
$email = moniEmail($body['email'] ?? null);
$password = moniPassword($body['password'] ?? $body['mot_de_passe'] ?? null);
$currency = moniIsoCurrency($body['currency'] ?? 'XOF');

moniHandleDatabase(function () use ($pdo, $name, $email, $password, $currency): void {
    try {
        $statement = $pdo->prepare('INSERT INTO utilisateurs (nom, email, `mot de passe`, solde_initial, devise, budget_mensuel, langue, preferences_json) VALUES (:name, :email, :password, 0, :currency, 0, \'fr\', :preferences)');
        $statement->execute([
            'name' => $name,
            'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'currency' => $currency,
            'preferences' => json_encode(['alerts' => ['budget' => true, 'subscriptions' => true, 'savings' => true]], JSON_THROW_ON_ERROR),
        ]);
    } catch (PDOException $exception) {
        if ($exception->getCode() === '23000') {
            moniError('EMAIL_EXISTS', 'Cette adresse e-mail est déjà utilisée.', 409);
        }
        throw $exception;
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $pdo->lastInsertId();
    $_SESSION['session_version'] = 1;
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    moniSuccess(['user' => ['id' => $_SESSION['user_id'], 'name' => $name, 'email' => $email], 'csrfToken' => $_SESSION['csrf_token']], 201);
});
