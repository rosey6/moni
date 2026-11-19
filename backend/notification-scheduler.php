<?php
declare(strict_types=1);
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/lib/notification_events.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

try {
    $pdo = moniConnect();
    $pdo->exec("SET time_zone = '+00:00'");
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $override = getenv('MONI_TEST_NOW') ?: '';
    if ($override !== '' && getenv('MONI_TEST_POOL') === 'moni-validation') $now = new DateTimeImmutable($override, new DateTimeZone('UTC'));
    $users = $pdo->query("SELECT u.id, COALESCE(c.timezone, 'UTC') AS timezone, u.langue FROM utilisateurs u LEFT JOIN notification_user_config c ON c.utilisateur_id = u.id")->fetchAll();
    $created = 0;
    foreach ($users as $user) {
        $userId = (int) $user['id'];
        $zone = new DateTimeZone($user['timezone']);
        $local = $now->setTimezone($zone);
        if ((int) $local->format('G') < 9) continue;
        $today = $local->format('Y-m-d');
        $english = $user['langue'] === 'en';
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT id FROM utilisateurs WHERE id = :user FOR UPDATE')->execute(['user' => $userId]);
            $subscriptions = $pdo->prepare('SELECT id, nom, jour_facturation FROM abonnements WHERE utilisateur_id = :user');
            $subscriptions->execute(['user' => $userId]);
            foreach ($subscriptions->fetchAll() as $subscription) {
                for ($monthOffset = 0; $monthOffset <= 2; $monthOffset++) {
                    $month = $local->modify('first day of this month')->modify('+' . $monthOffset . ' months');
                    $due = moniSubscriptionDue((int) $month->format('Y'), (int) $month->format('n'), (int) $subscription['jour_facturation'], $zone);
                    foreach ([3, 1, 0] as $daysBefore) {
                        $reminder = $due->modify('-' . $daysBefore . ' days');
                        if ($reminder->format('Y-m-d') !== $today) continue;
                        $when = $daysBefore === 0 ? ($english ? 'today' : 'aujourd’hui') : ($daysBefore === 1 ? ($english ? 'tomorrow' : 'demain') : ($english ? 'in 3 days' : 'dans 3 jours'));
                        $name = (string) $subscription['nom'];
                        $title = $name;
                        $message = $english ? "Your subscription is due {$when}." : "Ton abonnement arrive à échéance {$when}.";
                        $created += (int) moniEmitNotification($pdo, $userId, 'subscription:' . (int) $subscription['id'] . ':' . $due->format('Y-m-d') . ':' . $daysBefore, 'subscription', $title, $message, 'subscriptions-manage', 'subscription', (int) $subscription['id']);
                    }
                }
            }

            $goals = $pdo->prepare("SELECT g.id, g.nom, g.date_cible, g.montant_cible, COALESCE(SUM(c.montant), 0) AS saved FROM objectifs_epargne g LEFT JOIN contributions_epargne c ON c.objectif_id = g.id AND c.utilisateur_id = g.utilisateur_id WHERE g.utilisateur_id = :user AND g.mode = 'goal' AND g.date_cible = :due GROUP BY g.id");
            $dueDate = $local->modify('+7 days')->format('Y-m-d');
            $goals->execute(['user' => $userId, 'due' => $dueDate]);
            foreach ($goals->fetchAll() as $goal) {
                if ($goal['montant_cible'] === null || (int) $goal['saved'] >= (int) $goal['montant_cible']) continue;
                $name = (string) $goal['nom'];
                $title = $english ? "{$name}: one week left" : "{$name} : J-7";
                $message = $english ? 'Your target date is in seven days.' : 'Ton objectif arrive à échéance dans sept jours.';
                $created += (int) moniEmitNotification($pdo, $userId, 'savings-due:' . (int) $goal['id'] . ':' . $dueDate . ':7', 'savings', $title, $message, 'savings', 'goal', (int) $goal['id']);
            }

            if ($local->format('j') === '1') {
                $closed = $local->modify('first day of previous month');
                $period = $closed->format('Y-m');
                $monthNames = $english
                    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
                    : ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
                $closedLabel = $monthNames[(int) $closed->format('n') - 1] . ' ' . $closed->format('Y');
                $created += (int) moniEmitNotification($pdo, $userId, 'month-summary:' . $period, 'monthly', $english ? 'Your monthly summary is ready' : 'Ton bilan mensuel est prêt', $english ? "Your {$closedLabel} summary is available." : "Ton bilan de {$closedLabel} est disponible.", 'dashboard');
                $created += (int) moniEmitNotification($pdo, $userId, 'month-start:' . $local->format('Y-m'), 'monthly', $english ? 'A new month begins' : 'Un nouveau mois commence', $english ? 'Review your budget for this month.' : 'Pense à vérifier ton budget du mois.', 'budgets');
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $exception;
        }
    }
    fwrite(STDOUT, "scheduled_notifications={$created}\n");
} catch (Throwable $exception) {
    error_log('[moni-notification-scheduler] ' . get_class($exception));
    fwrite(STDERR, "notification scheduler failed\n");
    exit(1);
}
