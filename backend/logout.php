<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('POST');
$userId = moniRequireAuth(true, true);
if (isset($_SESSION['push_device_id'])) {
    $deviceId = (int) $_SESSION['push_device_id'];
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE push_deliveries SET status = 'cancelled', lease_owner = NULL, lease_until = NULL, updated_at = UTC_TIMESTAMP(6) WHERE device_id = :device AND status IN ('pending', 'leased')")->execute(['device' => $deviceId]);
        $pdo->prepare('UPDATE push_devices SET active = 0, subscription_ciphertext = \'\', updated_at = UTC_TIMESTAMP(6) WHERE id = :device AND utilisateur_id = :user')->execute(['device' => $deviceId, 'user' => $userId]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
}
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], '', (bool) $params['secure'], (bool) $params['httponly']);
}
session_destroy();
moniSuccess(['loggedOut' => true], 200);
