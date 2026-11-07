<?php
declare(strict_types=1);

require_once __DIR__ . '/api.php';
require_once dirname(__DIR__) . '/database.php';

ini_set('display_errors', '0');
ini_set('log_errors', '1');

$origin = getenv('MONI_CORS_ORIGIN') ?: '';
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && hash_equals($origin, $requestOrigin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$secureCookie = filter_var(getenv('MONI_COOKIE_SECURE') ?: '0', FILTER_VALIDATE_BOOLEAN);
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name(getenv('MONI_SESSION_NAME') ?: 'moni_session');
session_set_cookie_params([
    'httponly' => true,
    'secure' => $secureCookie,
    'samesite' => 'Lax',
    'path' => '/',
]);
if (session_status() !== PHP_SESSION_ACTIVE && !session_start()) {
    moniError('SESSION_ERROR', 'Session indisponible.', 500);
}

try {
    $pdo = moniConnect();
} catch (Throwable $exception) {
    error_log('[moni] database connection error: ' . $exception->getMessage());
    moniError('DATABASE_UNAVAILABLE', 'Le service est temporairement indisponible.', 503);
}

function moniUserId(): int
{
    global $pdo;
    $id = $_SESSION['user_id'] ?? null;
    if (!is_int($id) && !(is_string($id) && ctype_digit($id))) {
        moniError('AUTH_REQUIRED', 'Authentification requise.', 401);
    }
    try {
        $statement = $pdo->prepare('SELECT session_version FROM utilisateurs WHERE id = :id LIMIT 1');
        $statement->execute(['id' => (int) $id]);
        $version = $statement->fetchColumn();
    } catch (Throwable $exception) {
        error_log('[moni] session validation error: ' . $exception->getMessage());
        moniError('DATABASE_UNAVAILABLE', 'Le service est temporairement indisponible.', 503);
    }
    if ($version === false || (int) ($_SESSION['session_version'] ?? 0) !== (int) $version) {
        $_SESSION = [];
        moniError('AUTH_REQUIRED', 'Session invalide.', 401);
    }
    return (int) $id;
}

function moniRequireCsrf(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if (!is_string($token) || !is_string($expected) || $expected === '' || !hash_equals($expected, $token)) {
        moniError('CSRF_INVALID', 'Jeton CSRF invalide.', 403);
    }
}

function moniRequireAuth(bool $csrf = false): int
{
    $id = moniUserId();
    if ($csrf) {
        moniRequireCsrf();
    }
    return $id;
}

function moniCategorySlug(PDO $pdo, mixed $value): string
{
    $slug = is_string($value) ? trim($value) : '';
    if (!in_array($slug, ['rent', 'transport', 'groceries', 'unexpected'], true)) {
        moniError('INVALID_CATEGORY', 'Catégorie invalide.', 422);
    }
    return $slug;
}

function moniRateKey(string $email): string
{
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|' . strtolower($email));
}

function moniRateLimited(string $email, bool $recordFailure = false): bool
{
    $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'moni-login-' . moniRateKey($email) . '.json';
    $handle = @fopen($path, 'c+');
    if (!$handle) {
        return false;
    }
    flock($handle, LOCK_EX);
    $content = stream_get_contents($handle);
    $state = json_decode($content ?: '{}', true);
    $now = time();
    if (!is_array($state) || ($state['reset'] ?? 0) <= $now) {
        $state = ['attempts' => 0, 'reset' => $now + 900];
    }
    $limited = ($state['attempts'] ?? 0) >= 5;
    if ($recordFailure && !$limited) {
        $state['attempts']++;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($state));
    }
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    if (!$limited && $recordFailure && ($state['attempts'] ?? 0) >= 5) {
        return true;
    }
    return $limited;
}

function moniClearRateLimit(string $email): void
{
    $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'moni-login-' . moniRateKey($email) . '.json';
    @unlink($path);
}

function moniResetRateLimited(string $email, bool $recordFailure = false): bool
{
    $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'moni-reset-' . moniRateKey($email) . '.json';
    $handle = @fopen($path, 'c+');
    if (!$handle) return false;
    flock($handle, LOCK_EX);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    $now = time();
    if (!is_array($state) || ($state['reset'] ?? 0) <= $now) $state = ['attempts' => 0, 'reset' => $now + 3600];
    $limited = ($state['attempts'] ?? 0) >= 3;
    if ($recordFailure && !$limited) {
        $state['attempts']++;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($state));
    }
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $limited || ($recordFailure && ($state['attempts'] ?? 0) >= 3);
}

function moniCurrentState(PDO $pdo, int $userId): array
{
    $userStatement = $pdo->prepare('SELECT id, nom, email, solde_initial, devise, budget_mensuel, langue, preferences_json FROM utilisateurs WHERE id = :id LIMIT 1');
    $userStatement->execute(['id' => $userId]);
    $user = $userStatement->fetch();
    if (!$user) {
        moniError('AUTH_REQUIRED', 'Session invalide.', 401);
    }

    $month = new DateTimeImmutable('first day of this month');
    $budgetStatement = $pdo->prepare('SELECT c.slug, b.montant_limite FROM budgets b INNER JOIN categories c ON c.id = b.categorie_id WHERE b.utilisateur_id = :user AND b.mois = :month AND b.annee = :year');
    $budgetStatement->execute(['user' => $userId, 'month' => (int) $month->format('m'), 'year' => (int) $month->format('Y')]);
    $allocations = [];
    foreach ($budgetStatement->fetchAll() as $budget) {
        $allocations[$budget['slug']] = (int) $budget['montant_limite'];
    }

    $transactions = $pdo->prepare('SELECT t.id, t.type, t.montant AS amount, c.slug AS category, DATE_FORMAT(t.date_operation, \'%Y-%m-%d\') AS date, t.description FROM transactions t INNER JOIN categories c ON c.id = t.categorie_id WHERE t.utilisateur_id = :user ORDER BY t.date_operation DESC, t.id DESC');
    $transactions->execute(['user' => $userId]);
    $subscriptions = $pdo->prepare('SELECT a.id, a.nom AS name, a.montant_mensuel AS amount, a.jour_facturation AS billingDay, c.slug AS includedIn FROM abonnements a LEFT JOIN categories c ON c.id = a.categorie_id WHERE a.utilisateur_id = :user ORDER BY a.nom');
    $subscriptions->execute(['user' => $userId]);
    $goals = $pdo->prepare('SELECT id, nom AS name, montant_cible AS target, DATE_FORMAT(date_cible, \'%Y-%m-%d\') AS date FROM objectifs_epargne WHERE utilisateur_id = :user ORDER BY date_cible, id');
    $goals->execute(['user' => $userId]);
    $goalRows = $goals->fetchAll();
    $contributions = $pdo->prepare('SELECT id, objectif_id, montant AS amount FROM contributions_epargne WHERE utilisateur_id = :user ORDER BY id');
    $contributions->execute(['user' => $userId]);
    $byGoal = [];
    foreach ($contributions->fetchAll() as $contribution) {
        $byGoal[(int) $contribution['objectif_id']][] = ['id' => (int) $contribution['id'], 'amount' => (int) $contribution['amount']];
    }
    foreach ($goalRows as &$goal) {
        $goal['id'] = (int) $goal['id'];
        $goal['target'] = (int) $goal['target'];
        $goal['contributions'] = $byGoal[$goal['id']] ?? [];
    }
    unset($goal);

    $preferences = json_decode((string) ($user['preferences_json'] ?? ''), true);
    if (!is_array($preferences)) {
        $preferences = ['alerts' => ['budget' => true, 'subscriptions' => true, 'savings' => true]];
    }
    $preferences['language'] = $user['langue'] ?: 'fr';
    return [
        'currency' => $user['devise'] ?: 'XOF',
        'budget' => (int) ($user['budget_mensuel'] ?? 0),
        'allocations' => $allocations,
        'subscriptions' => array_map(static function (array $item): array {
            $item['id'] = (int) $item['id'];
            $item['amount'] = (int) $item['amount'];
            $item['billingDay'] = (int) $item['billingDay'];
            return $item;
        }, $subscriptions->fetchAll()),
        'transactions' => array_map(static function (array $item): array {
            $item['id'] = (int) $item['id'];
            $item['amount'] = (int) $item['amount'];
            return $item;
        }, $transactions->fetchAll()),
        'goals' => array_map(static fn (array $item): array => $item, $goalRows),
        'profile' => ['id' => (int) $user['id'], 'name' => $user['nom'], 'email' => $user['email']],
        'preferences' => $preferences,
    ];
}
