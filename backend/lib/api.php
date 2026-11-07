<?php
declare(strict_types=1);

function moniJson(mixed $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function moniSuccess(array $data = [], int $status = 200): never
{
    moniJson(['success' => true, 'data' => $data], $status);
}

function moniError(string $code, string $message, int $status, array $details = []): never
{
    $error = ['code' => $code, 'message' => $message];
    if ($details !== []) {
        $error['details'] = $details;
    }
    moniJson(['success' => false, 'error' => $error], $status);
}

function moniMethod(string ...$methods): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        moniError('METHOD_NOT_ALLOWED', 'Méthode HTTP non autorisée.', 405);
    }
}

function moniBody(): array
{
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        moniError('INVALID_JSON', 'Le corps JSON est invalide.', 400);
    }
    return $body;
}

function moniId(mixed $value, string $field = 'id'): int
{
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        moniError('INVALID_ID', "Identifiant {$field} invalide.", 422);
    }
    return (int) $id;
}

function moniAmount(mixed $value, string $field = 'amount', bool $allowZero = true): int
{
    if (is_int($value)) {
        $amount = $value;
    } elseif (is_string($value) && preg_match('/^(0|[1-9][0-9]*)$/', $value) === 1) {
        $amount = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        if ($amount === false) {
            moniError('INVALID_AMOUNT', "Montant {$field} invalide.", 422);
        }
    } else {
        moniError('INVALID_AMOUNT', "Montant {$field} invalide.", 422);
    }
    if ($amount < ($allowZero ? 0 : 1) || $amount > 11258999068426) {
        moniError('INVALID_AMOUNT', "Montant {$field} invalide.", 422);
    }
    return $amount;
}

function moniDate(mixed $value, string $field = 'date', bool $futureOnly = false): string
{
    if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
        moniError('INVALID_DATE', "Date {$field} invalide.", 422);
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    $errors = DateTimeImmutable::getLastErrors();
    if (!$date || ($errors !== false && ($errors['warning_count'] || $errors['error_count'])) || $date->format('Y-m-d') !== $value) {
        moniError('INVALID_DATE', "Date {$field} invalide.", 422);
    }
    if ($futureOnly && $date < new DateTimeImmutable('today')) {
        moniError('INVALID_DATE', "La date {$field} doit être aujourd'hui ou ultérieure.", 422);
    }
    return $value;
}

function moniText(mixed $value, string $field, int $max, bool $required = true): string
{
    if (!is_string($value)) {
        moniError('INVALID_FIELD', "Champ {$field} invalide.", 422);
    }
    $value = trim($value);
    if (($required && $value === '') || mb_strlen($value) > $max) {
        moniError('INVALID_FIELD', "Champ {$field} invalide.", 422);
    }
    return $value;
}

function moniEmail(mixed $value): string
{
    $email = is_string($value) ? strtolower(trim($value)) : '';
    if ($email === '' || strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        moniError('INVALID_EMAIL', 'Adresse e-mail invalide.', 422);
    }
    return $email;
}

function moniPassword(mixed $value): string
{
    if (!is_string($value) || strlen($value) < 8 || strlen($value) > 255) {
        moniError('INVALID_PASSWORD', 'Le mot de passe doit contenir entre 8 et 255 caractères.', 422);
    }
    return $value;
}

function moniIsoCurrency(mixed $value): string
{
    $currency = is_string($value) ? strtoupper(trim($value)) : '';
    if (!in_array($currency, ['XOF', 'MAD', 'EUR', 'USD'], true)) {
        moniError('INVALID_CURRENCY', 'Devise non prise en charge.', 422);
    }
    return $currency;
}

function moniHandleDatabase(callable $handler): never
{
    try {
        $handler();
    } catch (PDOException $exception) {
        error_log('[moni] database error: ' . $exception->getMessage());
        moniError('DATABASE_ERROR', 'Une erreur interne est survenue.', 500);
    } catch (Throwable $exception) {
        error_log('[moni] application error: ' . $exception->getMessage());
        moniError('SERVER_ERROR', 'Une erreur interne est survenue.', 500);
    }
    moniError('SERVER_ERROR', 'Une erreur interne est survenue.', 500);
}
