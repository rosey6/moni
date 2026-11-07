<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('POST');
$body = moniBody();
$token = is_string($body['token'] ?? null) ? trim($body['token']) : '';
if (preg_match('/^[a-f0-9]{64}$/', $token) !== 1) moniError('RESET_TOKEN_INVALID', 'Lien de réinitialisation invalide ou expiré.', 400);
$password = moniPassword($body['password'] ?? null);
if (array_key_exists('passwordConfirmation', $body) && $body['passwordConfirmation'] !== $password) moniError('PASSWORD_MISMATCH', 'Les mots de passe ne correspondent pas.', 422);

moniHandleDatabase(function () use ($pdo, $token, $password): void {
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT id, utilisateur_id FROM password_reset_tokens WHERE token_hash = :hash AND used_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE');
        $statement->execute(['hash' => hash('sha256', $token, true)]);
        $reset = $statement->fetch();
        if (!$reset) {
            $pdo->rollBack();
            moniError('RESET_TOKEN_INVALID', 'Lien de réinitialisation invalide ou expiré.', 400);
        }
        $passwordStatement = $pdo->prepare('UPDATE utilisateurs SET `mot de passe` = :password, session_version = session_version + 1 WHERE id = :user');
        $passwordStatement->execute(['password' => password_hash($password, PASSWORD_DEFAULT), 'user' => $reset['utilisateur_id']]);
        $pdo->prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = :id')->execute(['id' => $reset['id']]);
        $pdo->prepare('DELETE FROM password_reset_tokens WHERE utilisateur_id = :user AND used_at IS NULL')->execute(['user' => $reset['utilisateur_id']]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    moniSuccess(['reset' => true]);
});
