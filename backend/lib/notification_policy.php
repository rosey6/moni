<?php
declare(strict_types=1);

/** Pure policy helpers; persistence and delivery must be supplied by the worker. */
function moniThresholdAtLeast(int $value, int $total, int $percent): bool
{
    if ($total <= 0 || $value < 0 || $percent < 1 || $percent > 100) return false;
    $required = intdiv($total, 100) * $percent + intdiv(($total % 100) * $percent + 99, 100);
    return $value >= $required;
}

function moniBudgetCrossing(int $before, int $after, int $budget, array $alreadySent = []): ?string
{
    if ($budget <= 0 || $before < 0 || $after <= $before) return null;
    if ($before <= $budget && $after > $budget && !in_array('over', $alreadySent, true)) return 'over';
    foreach ([100, 80] as $threshold) {
        $key = (string) $threshold;
        if (!in_array($key, $alreadySent, true) && !moniThresholdAtLeast($before, $budget, $threshold) && moniThresholdAtLeast($after, $budget, $threshold)) return $key;
    }
    return null;
}

function moniSavingsCrossing(string $mode, int $before, int $after, int $target, array $alreadySent = []): ?int
{
    if ($mode !== 'goal' || $target <= 0 || $before < 0 || $after <= $before) return null;
    foreach ([100, 75, 50, 25] as $threshold) {
        if (!in_array($threshold, $alreadySent, true) && !moniThresholdAtLeast($before, $target, $threshold) && moniThresholdAtLeast($after, $target, $threshold)) return $threshold;
    }
    return null;
}

function moniNotificationAllowed(bool $security, bool $financialEnabled, int $financialSentToday): bool
{
    return $security || ($financialEnabled && $financialSentToday >= 0 && $financialSentToday < 3);
}

function moniNextPushTime(DateTimeImmutable $instant, DateTimeZone $zone, bool $security = false): DateTimeImmutable
{
    $utc = new DateTimeZone('UTC');
    if ($security) return $instant->setTimezone($utc);
    $local = $instant->setTimezone($zone);
    $hour = (int) $local->format('G');
    if ($hour < 8) return $local->setTime(8, 0)->setTimezone($utc);
    if ($hour >= 21) return $local->modify('+1 day')->setTime(8, 0)->setTimezone($utc);
    return $instant->setTimezone($utc);
}

function moniSubscriptionDue(int $year, int $month, int $day, DateTimeZone $zone): DateTimeImmutable
{
    if ($year < 1 || $year > 9999 || $month < 1 || $month > 12 || $day < 1 || $day > 31) throw new InvalidArgumentException('Date invalide');
    $first = new DateTimeImmutable(sprintf('%04d-%02d-01 00:00:00', $year, $month), $zone);
    return $first->setDate($year, $month, min($day, (int) $first->format('t')));
}

function moniMonthlyStart(int $year, int $month, DateTimeZone $zone): DateTimeImmutable
{
    return moniSubscriptionDue($year, $month, 1, $zone)->setTime(9, 0)->setTimezone(new DateTimeZone('UTC'));
}
