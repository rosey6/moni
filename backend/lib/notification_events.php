<?php
declare(strict_types=1);

require_once __DIR__ . '/notification_policy.php';

function moniFinancialNotificationsEnabled(PDO $pdo, int $userId): bool
{
    $statement = $pdo->prepare('SELECT preferences_json FROM utilisateurs WHERE id = :user LIMIT 1');
    $statement->execute(['user' => $userId]);
    $preferences = json_decode((string) $statement->fetchColumn(), true);
    $alerts = is_array($preferences) && is_array($preferences['alerts'] ?? null) ? $preferences['alerts'] : [];
    foreach (['budget', 'subscriptions', 'savings'] as $key) {
        if (array_key_exists($key, $alerts) && $alerts[$key] !== true) return false;
    }
    return true;
}

function moniEmitNotification(
    PDO $pdo,
    int $userId,
    string $eventKey,
    string $type,
    string $title,
    string $message,
    ?string $destination,
    ?string $resourceType = null,
    ?int $resourceId = null,
    bool $security = false
): bool {
    if (!$pdo->inTransaction()) throw new LogicException('Notifications must share the business transaction.');
    if (!$security && !moniFinancialNotificationsEnabled($pdo, $userId)) return false;
    if (!in_array($type, ['budget', 'subscription', 'savings', 'monthly', 'security'], true)) throw new InvalidArgumentException('Invalid notification type.');
    if ($destination !== null && !in_array($destination, ['dashboard', 'budgets', 'subscriptions-manage', 'savings', 'profile', 'notifications'], true)) throw new InvalidArgumentException('Invalid notification destination.');
    if ($resourceType !== null && !in_array($resourceType, ['budget', 'subscription', 'goal', 'transaction'], true)) throw new InvalidArgumentException('Invalid notification resource.');
    if (strlen($eventKey) < 1 || strlen($eventKey) > 191 || strlen($title) > 120 || strlen($message) > 500) throw new InvalidArgumentException('Invalid notification content.');

    $insert = $pdo->prepare('INSERT IGNORE INTO notifications (utilisateur_id, notification_key, event_type, title, message, destination, resource_type, resource_id) VALUES (:user, :key, :type, :title, :message, :destination, :resource_type, :resource_id)');
    $insert->execute([
        'user' => $userId,
        'key' => $eventKey,
        'type' => $type,
        'title' => $title,
        'message' => $message,
        'destination' => $destination,
        'resource_type' => $resourceType,
        'resource_id' => $resourceId,
    ]);
    if ($insert->rowCount() !== 1) return false;

    $notificationId = (int) $pdo->lastInsertId();
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $payload = json_encode(['title' => 'Moni', 'body' => 'Tu as une nouvelle notification.', 'url' => '/#notifications'], JSON_THROW_ON_ERROR);
    $outbox = $pdo->prepare('INSERT INTO notification_events (utilisateur_id, event_key, event_type, destination, notification_id, payload_json, due_at, next_attempt_at, expires_at, status, created_at) VALUES (:user, :key, :type, :destination, :notification, :payload, :due, :next_attempt, :expires, \'pending\', :created)');
    $outbox->execute([
        'user' => $userId,
        'key' => $eventKey,
        'type' => $type,
        'destination' => $destination,
        'notification' => $notificationId,
        'payload' => $payload,
        'due' => $now->format('Y-m-d H:i:s.u'),
        'next_attempt' => $now->format('Y-m-d H:i:s.u'),
        'expires' => $now->modify('+2 days')->format('Y-m-d H:i:s.u'),
        'created' => $now->format('Y-m-d H:i:s.u'),
    ]);
    return true;
}

function moniBudgetSnapshot(PDO $pdo, int $userId, string $category, string $date): array
{
    $period = new DateTimeImmutable($date, new DateTimeZone('UTC'));
    $budget = $pdo->prepare('SELECT b.id, b.montant_limite FROM budgets b INNER JOIN categories c ON c.id = b.categorie_id WHERE b.utilisateur_id = :user AND c.slug = :category AND b.mois = :month AND b.annee = :year LIMIT 1');
    $budget->execute(['user' => $userId, 'category' => $category, 'month' => (int) $period->format('n'), 'year' => (int) $period->format('Y')]);
    $row = $budget->fetch() ?: ['id' => null, 'montant_limite' => 0];
    $spend = $pdo->prepare('SELECT COALESCE(SUM(t.montant), 0) FROM transactions t INNER JOIN categories c ON c.id = t.categorie_id WHERE t.utilisateur_id = :user AND c.slug = :category AND t.type = \'expense\' AND t.date_operation >= :start AND t.date_operation < :end');
    $start = $period->modify('first day of this month')->format('Y-m-d');
    $end = $period->modify('first day of next month')->format('Y-m-d');
    $spend->execute(['user' => $userId, 'category' => $category, 'start' => $start, 'end' => $end]);
    return ['id' => $row['id'] === null ? null : (int) $row['id'], 'limit' => (int) $row['montant_limite'], 'spent' => (int) $spend->fetchColumn()];
}

function moniEmitBudgetCrossing(PDO $pdo, int $userId, string $category, string $period, array $before, array $after): void
{
    $threshold = moniBudgetCrossing($before['spent'], $after['spent'], $after['limit']);
    if ($threshold === null || $after['id'] === null) return;
    $categoryName = [
        'rent' => ['Loyer', 'Rent'],
        'transport' => ['Transport', 'Transport'],
        'groceries' => ['Courses', 'Groceries'],
        'unexpected' => ['Imprévus', 'Unexpected'],
    ][$category] ?? [$category, $category];
    $language = $pdo->prepare('SELECT langue FROM utilisateurs WHERE id = :user');
    $language->execute(['user' => $userId]);
    $english = $language->fetchColumn() === 'en';
    $name = $categoryName[$english ? 1 : 0];
    $percent = $threshold === 'over' ? null : (int) $threshold;
    $title = ($english ? 'Budget ' : 'Budget ') . $name;
    $message = $threshold === 'over'
        ? ($english ? "Your {$name} budget is over its limit." : "Ton budget {$name} est dépassé.")
        : ($english ? "You have used at least {$percent}% of your {$name} budget." : "Tu as utilisé au moins {$percent} % de ton budget {$name}.");
    moniEmitNotification($pdo, $userId, "budget:{$period}:{$category}:{$threshold}", 'budget', $title, $message, 'budgets', 'budget', $after['id']);
}

function moniSavingsTotal(PDO $pdo, int $userId, int $goalId): int
{
    $statement = $pdo->prepare('SELECT COALESCE(SUM(montant), 0) FROM contributions_epargne WHERE utilisateur_id = :user AND objectif_id = :goal');
    $statement->execute(['user' => $userId, 'goal' => $goalId]);
    return (int) $statement->fetchColumn();
}

function moniEmitSavingsCrossing(PDO $pdo, int $userId, int $goalId, int $before, int $after): void
{
    if ($after <= $before) return;
    $goal = $pdo->prepare('SELECT nom, mode, montant_cible FROM objectifs_epargne WHERE id = :goal AND utilisateur_id = :user');
    $goal->execute(['goal' => $goalId, 'user' => $userId]);
    $row = $goal->fetch();
    if (!$row || $row['mode'] !== 'goal' || $row['montant_cible'] === null) return;
    $threshold = moniSavingsCrossing('goal', $before, $after, (int) $row['montant_cible']);
    if ($threshold === null) return;
    $language = $pdo->prepare('SELECT langue FROM utilisateurs WHERE id = :user');
    $language->execute(['user' => $userId]);
    $english = $language->fetchColumn() === 'en';
    $name = (string) $row['nom'];
    $title = $english ? "{$name} is progressing" : "{$name} avance";
    $message = $english ? "Your savings goal reached {$threshold}%." : "Ton objectif d’épargne a atteint {$threshold} %.";
    moniEmitNotification($pdo, $userId, "savings:{$goalId}:{$threshold}", 'savings', $title, $message, 'savings', 'goal', $goalId);
}
