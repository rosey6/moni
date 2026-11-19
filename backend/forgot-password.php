<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/mailer.php';

moniMethod('POST');
$body = moniBody();
$email = moniEmail($body['email'] ?? null);
if (moniResetRateLimited($email)) moniError('RATE_LIMITED', 'Trop de demandes. Réessaie dans quelques minutes.', 429);

moniHandleDatabase(function () use ($pdo, $email): void {
    $statement = $pdo->prepare('SELECT id, nom FROM utilisateurs WHERE email = :email LIMIT 1');
    $statement->execute(['email' => $email]);
    $user = $statement->fetch();
    if (!$user) {
        moniResetRateLimited($email, true);
        moniSuccess(['requested' => true], 202);
    }

    moniResetRateLimited($email, true);
    $token = bin2hex(random_bytes(32));
    $insert = $pdo->prepare('INSERT INTO password_reset_tokens (utilisateur_id, token_hash, expires_at) VALUES (:user, :hash, DATE_ADD(NOW(), INTERVAL 60 MINUTE))');
    $insert->execute(['user' => $user['id'], 'hash' => hash('sha256', $token, true)]);
    $tokenId = (int) $pdo->lastInsertId();
    try {
        moniSendPasswordResetEmail($email, (string) $user['nom'], $token);
    } catch (Throwable $exception) {
        $pdo->prepare('DELETE FROM password_reset_tokens WHERE id = :id')->execute(['id' => $tokenId]);
        error_log('[moni] password reset email delivery failed.');
        moniError('EMAIL_UNAVAILABLE', 'Le service d’e-mail est temporairement indisponible.', 503);
    }
    moniSuccess(['requested' => true], 202);
});
