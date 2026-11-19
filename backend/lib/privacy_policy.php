<?php
declare(strict_types=1);
function moniApprovedPrivacyPolicy(): ?array
{
    $path = getenv('MONI_PRIVACY_POLICY_FILE');
    if (!$path || !is_file($path) || !is_readable($path)) return null;
    $policy = json_decode((string) file_get_contents($path), true);
    if (!is_array($policy) || !is_string($policy['version'] ?? null) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/D', $policy['version']) || !is_string($policy['text'] ?? null) || trim($policy['text']) === '') return null;
    return $policy;
}
