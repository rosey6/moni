<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/api.php';
require_once __DIR__ . '/lib/privacy_policy.php';
moniMethod('GET');
$origin = getenv('MONI_CORS_ORIGIN') ?: '';
if ($origin !== '' && hash_equals($origin, $_SERVER['HTTP_ORIGIN'] ?? '')) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$policy = moniApprovedPrivacyPolicy();
if (!$policy) moniError('PRIVACY_POLICY_UNAVAILABLE', 'La politique de confidentialité n’est pas encore disponible.', 503);
if (($_GET['format'] ?? '') === 'json') moniSuccess(['version' => $policy['version']]);
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Politique de confidentialité — Moni</title></head><body><main><h1>Politique de confidentialité — Moni</h1><p>Version ' . htmlspecialchars($policy['version'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p><pre>' . htmlspecialchars($policy['text'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</pre></main></body></html>';
