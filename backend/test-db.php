<?php
declare(strict_types=1);

// Diagnostic scripts are CLI-only and are not public API endpoints.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/database.php';
moniConnect();
fwrite(STDOUT, "Connexion à la base de données réussie.\n");
