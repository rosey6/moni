<?php
declare(strict_types=1);

function moniEnv(string $name, ?string $default = null): string
{
    $value = getenv($name);
    return $value === false ? ($default ?? '') : $value;
}

function moniConnect(): PDO
{
    $host = moniEnv('MONI_DB_HOST', '127.0.0.1');
    $port = moniEnv('MONI_DB_PORT', '3306');
    $name = moniEnv('MONI_DB_NAME', 'moni');
    $user = moniEnv('MONI_DB_USER');
    $password = moniEnv('MONI_DB_PASSWORD');
    if ($user === '' || $password === '') {
        throw new RuntimeException('Database credentials are not configured.');
    }
    $pdo = new PDO(
        "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    return $pdo;
}
