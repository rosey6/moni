<?php
declare(strict_types=1);
require_once __DIR__ . '/database.php';
$autoload = getenv('MONI_COMPOSER_AUTOLOAD') ?: __DIR__ . '/vendor/autoload.php';
if (!is_file($autoload)) {
    fwrite(STDERR, "Composer dependencies are unavailable\n");
    exit(1);
}
require_once $autoload;
require_once __DIR__ . '/lib/push_worker.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

try {
    $transportName = getenv('MONI_PUSH_TRANSPORT') ?: 'disabled';
    $pushEnabled = getenv('MONI_PUSH_ENABLED') === '1';
    if ($transportName === 'simulated') {
        if (getenv('MONI_TEST_POOL') !== 'moni-validation') throw new RuntimeException('Simulated transport is restricted to the isolated test pool.');
        $transport = new MoniSimulatedPushTransport();
    } elseif ($transportName === 'live') {
        $isolatedAuthorized = getenv('MONI_TEST_POOL') === 'moni-validation' && getenv('MONI_TEST_PUSH_DEVICE_AUTHORIZED') === '1';
        $runtimeAuthorized = getenv('MONI_PUSH_LIVE_AUTHORIZED') === '1';
        if (!$isolatedAuthorized && !$runtimeAuthorized) {
            throw new RuntimeException('Live push requires explicit runtime authorization.');
        }
        $transport = $pushEnabled ? new MoniWebPushTransport() : new class implements MoniPushTransport {
            public function send(array $subscription, string $payload): array { throw new LogicException('Push sending is disabled.'); }
        };
    } elseif ($transportName === 'disabled') {
        $transport = new class implements MoniPushTransport {
            public function send(array $subscription, string $payload): array { throw new LogicException('Push sending is disabled.'); }
        };
        $pushEnabled = false;
    } else {
        throw new RuntimeException('Unknown push transport.');
    }
    if ($transportName === 'simulated' && !$pushEnabled) throw new RuntimeException('Set MONI_PUSH_ENABLED=1 only for the isolated worker test.');
    $pdo = moniConnect();
    $pdo->exec("SET time_zone = '+00:00'");
    $daemon = in_array('--daemon', $argv ?? [], true);
    do {
        $result = moniRunPushWorker($pdo, $transport, $pushEnabled);
        fwrite(STDOUT, 'events=' . $result['events'] . ' deliveries=' . $result['deliveries'] . "\n");
        if ($daemon) sleep(15);
    } while ($daemon);
} catch (Throwable $exception) {
    error_log('[moni-notification-worker] ' . get_class($exception) . ' (' . (string) $exception->getCode() . ')');
    fwrite(STDERR, "notification worker failed\n");
    exit(1);
}
