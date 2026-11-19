<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';
require_once __DIR__ . '/lib/push_config.php';
moniMethod('GET');
moniRequireAuth();
$enabled = moniPushAvailable();
moniSuccess(['enabled' => $enabled, 'publicKey' => $enabled ? getenv('MONI_VAPID_PUBLIC_KEY') : null]);
