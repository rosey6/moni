<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('GET');
$userId = moniRequireAuth();
moniHandleDatabase(function () use ($pdo, $userId): void {
    $state = moniCurrentState($pdo, $userId);
    moniSuccess(['user' => $state['profile'], 'csrfToken' => $_SESSION['csrf_token'] ??= bin2hex(random_bytes(32)), 'state' => $state]);
});
