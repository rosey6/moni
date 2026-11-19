<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only\n");
    exit(1);
}

require_once dirname(__DIR__, 2) . '/database.php';

$expected = 'moni_validation_vps';
$actual = moniConnect()->query('SELECT DATABASE()')->fetchColumn();
if ($actual !== $expected) {
    fwrite(STDERR, "Validation database mismatch: expected {$expected}, got " . (string) $actual . "\n");
    exit(1);
}

fwrite(STDOUT, "Validation database confirmed: {$actual}\n");
