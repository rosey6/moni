<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/lib/notification_policy.php';
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
check(moniBudgetCrossing(70, 85, 100) === '80', 'budget 80');
check(moniBudgetCrossing(70, 100, 100) === '100', 'budget 100');
check(moniBudgetCrossing(70, 101, 100) === 'over', 'dépassement prioritaire');
check(moniBudgetCrossing(70, 85, 100, ['80']) === null, 'déduplication');
check(moniBudgetCrossing(100, 100, 100) === null && moniBudgetCrossing(0, 2, 0) === null, 'zéro et absence de franchissement');
check(moniSavingsCrossing('goal', 0, 76, 100) === 75, 'palier le plus élevé');
check(moniSavingsCrossing('goal', 45, 55, 100, [50]) === null, 'palier déjà émis');
check(moniSavingsCrossing('free', 0, 100, 100) === null, 'épargne libre');
check(moniThresholdAtLeast(PHP_INT_MAX, PHP_INT_MAX, 100), 'précision entière');
check(moniNotificationAllowed(false, true, 2) && !moniNotificationAllowed(false, true, 3), 'quota');
check(!moniNotificationAllowed(false, false, 0) && moniNotificationAllowed(true, false, 3), 'préférences et sécurité');
$zone = new DateTimeZone('Africa/Casablanca');
check(moniNextPushTime(new DateTimeImmutable('2026-11-13 21:00:00', $zone), $zone)->setTimezone($zone)->format('Y-m-d H:i') === '2026-11-14 08:00', 'heures silencieuses soir');
check(moniNextPushTime(new DateTimeImmutable('2026-11-13 07:59:00', $zone), $zone)->setTimezone($zone)->format('H:i') === '08:00', 'heures silencieuses matin');
check(moniNextPushTime(new DateTimeImmutable('2026-11-13 21:00:00', $zone), $zone, true)->setTimezone($zone)->format('H:i') === '21:00', 'sécurité immédiate');
check(moniSubscriptionDue(2027, 2, 31, $zone)->format('Y-m-d') === '2027-02-28', 'février court');
check(moniSubscriptionDue(2028, 2, 31, $zone)->format('Y-m-d') === '2028-02-29', 'février bissextile');
check(moniMonthlyStart(2026, 11, $zone)->setTimezone($zone)->format('Y-m-d H:i') === '2026-11-01 09:00', 'nouveau mois local');
$ny = new DateTimeZone('America/New_York');
check(moniNextPushTime(new DateTimeImmutable('2026-03-08 01:30:00', $ny), $ny)->setTimezone($ny)->format('H:i') === '08:00', 'transition DST');
echo "NOTIFICATION_POLICY_PASS\n";
