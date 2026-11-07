<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('GET');
$userId = moniRequireAuth();
moniHandleDatabase(function () use ($pdo, $userId): void {
    moniSuccess(['state' => moniCurrentState($pdo, $userId)]);
});
