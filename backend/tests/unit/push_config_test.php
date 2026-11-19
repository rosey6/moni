<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/lib/push_config.php';

function checkPushConfig(bool $expected, string $case): void
{
    if (moniPushAvailable() !== $expected) throw new RuntimeException("Push configuration {$case} failed.");
}

$privateFile = tempnam(sys_get_temp_dir(), 'moni-push-config-');
if ($privateFile === false) throw new RuntimeException('Unable to create a private-key fixture.');
try {
    file_put_contents($privateFile, 'test-private-key');
    putenv('MONI_PUSH_ENABLED=1');
    putenv('MONI_PUSH_TRANSPORT=live');
    putenv('MONI_VAPID_PUBLIC_KEY=' . str_repeat('A', 88));
    putenv('MONI_VAPID_PRIVATE_KEY_FILE=' . $privateFile);
    putenv('MONI_VAPID_SUBJECT=mailto:push@example.test');
    putenv('MONI_TEST_POOL=');
    putenv('MONI_TEST_PUSH_DEVICE_AUTHORIZED=');
    putenv('MONI_PUSH_LIVE_AUTHORIZED=1');
    checkPushConfig(true, 'authorized runtime');
    putenv('MONI_PUSH_LIVE_AUTHORIZED=');
    checkPushConfig(false, 'default closed');
    putenv('MONI_TEST_POOL=moni-validation');
    putenv('MONI_TEST_PUSH_DEVICE_AUTHORIZED=1');
    checkPushConfig(true, 'authorized isolated device');
    putenv('MONI_PUSH_TRANSPORT=disabled');
    checkPushConfig(false, 'disabled transport');
    echo "PUSH_CONFIG_PASS\n";
} finally {
    unlink($privateFile);
}
