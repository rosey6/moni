<?php
declare(strict_types=1);

function moniPushAvailable(): bool
{
    $public = getenv('MONI_VAPID_PUBLIC_KEY') ?: '';
    $privateFile = getenv('MONI_VAPID_PRIVATE_KEY_FILE') ?: '';
    $private = $privateFile !== '' && is_readable($privateFile) ? trim((string) @file_get_contents($privateFile)) : '';
    $subject = getenv('MONI_VAPID_SUBJECT') ?: '';
    $authorized = getenv('MONI_PUSH_LIVE_AUTHORIZED') === '1'
        || (getenv('MONI_TEST_POOL') === 'moni-validation' && getenv('MONI_TEST_PUSH_DEVICE_AUTHORIZED') === '1');
    return getenv('MONI_PUSH_ENABLED') === '1'
        && getenv('MONI_PUSH_TRANSPORT') === 'live'
        && $authorized
        && preg_match('/^[A-Za-z0-9_-]{80,100}$/', $public) === 1
        && $private !== ''
        && preg_match('/^mailto:[^\s@]+@[^\s@]+$|^https:\/\//', $subject) === 1;
}
