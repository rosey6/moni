<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('POST');
$body = moniBody();
$email = moniEmail($body['email'] ?? null);
$password = $body['password'] ?? $body['mot_de_passe'] ?? null;
if (!is_string($password) || $password === '' || strlen($password) > 255) {
    moniError('INVALID_CREDENTIALS', 'Identifiants invalides.', 401);
}
if (moniRateLimited($email)) {
    moniError('RATE_LIMITED', 'Trop de tentatives. Réessaie dans quelques minutes.', 429);
}

moniHandleDatabase(function () use ($pdo, $email, $password): void {
    $statement = $pdo->prepare('SELECT id, nom, email, `mot de passe`, devise, session_version FROM utilisateurs WHERE email = :email LIMIT 1');
    $statement->execute(['email' => $email]);
    $user = $statement->fetch();
    if (!$user || !password_verify($password, (string) $user['mot de passe'])) {
        moniRateLimited($email, true);
        moniError('INVALID_CREDENTIALS', 'Email ou mot de passe incorrect.', 401);
    }
    moniClearRateLimit($email);
    if (password_needs_rehash((string) $user['mot de passe'], PASSWORD_DEFAULT)) {
        $rehash = $pdo->prepare('UPDATE utilisateurs SET `mot de passe` = :password WHERE id = :id');
        $rehash->execute(['password' => password_hash($password, PASSWORD_DEFAULT), 'id' => $user['id']]);
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['session_version'] = (int) $user['session_version'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    moniSuccess([
        'user' => ['id' => (int) $user['id'], 'name' => $user['nom'], 'email' => $user['email']],
        'csrfToken' => $_SESSION['csrf_token'],
        'state' => moniCurrentState($pdo, (int) $user['id']),
    ]);
});
