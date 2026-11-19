<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/bootstrap.php';

moniMethod('PUT', 'POST');
$userId = moniRequireAuth(true);
$body = moniBody();
$currency = moniIsoCurrency($body['currency'] ?? 'XOF');
$monthlyBudget = moniAmount($body['budget'] ?? 0, 'budget');
$allocations = $body['allocations'] ?? $body['plannedAllocations'] ?? [];
if (!is_array($allocations)) {
    moniError('INVALID_ALLOCATIONS', 'Allocations invalides.', 422);
}
$normalizedAllocations = [];
foreach ($allocations as $key => $item) {
    $slug = is_array($item) ? moniCategorySlug($pdo, $item['category'] ?? null) : moniCategorySlug($pdo, $key);
    $amount = is_array($item) ? ($item['amount'] ?? null) : $item;
    $normalizedAllocations[$slug] = moniAmount($amount, 'allocation');
}
$subscriptions = $body['subscriptions'] ?? [];
if (!is_array($subscriptions)) {
    moniError('INVALID_SUBSCRIPTIONS', 'Abonnements invalides.', 422);
}
$normalizedSubscriptions = [];
$subscriptionNames = [];
foreach ($subscriptions as $subscription) {
    if (!is_array($subscription)) moniError('INVALID_SUBSCRIPTION', 'Abonnement invalide.', 422);
    $includedIn = $subscription['includedIn'] ?? null;
    if ($includedIn !== null && $includedIn !== '') $includedIn = moniCategorySlug($pdo, $includedIn);
    $billingDay = filter_var($subscription['billingDay'] ?? null, FILTER_VALIDATE_INT);
    if ($billingDay === false || $billingDay < 1 || $billingDay > 31) moniError('INVALID_BILLING_DAY', 'Jour de facturation invalide.', 422);
    $subscriptionName = moniText($subscription['name'] ?? null, 'subscription.name', 80);
    $nameKey = mb_strtolower($subscriptionName);
    if (isset($subscriptionNames[$nameKey])) moniError('DUPLICATE_SUBSCRIPTION', 'Cet abonnement existe déjà.', 409);
    $subscriptionNames[$nameKey] = true;
    $normalizedSubscriptions[] = [
        'name' => $subscriptionName,
        'amount' => moniAmount($subscription['amount'] ?? null, 'subscription.amount'),
        'billingDay' => $billingDay,
        'includedIn' => $includedIn,
    ];
}

moniHandleDatabase(function () use ($pdo, $userId, $currency, $monthlyBudget, $normalizedAllocations, $normalizedSubscriptions): void {
    $pdo->beginTransaction();
    try {
        $user = $pdo->prepare('UPDATE utilisateurs SET devise = :currency, budget_mensuel = :budget, preferences_json = JSON_SET(COALESCE(preferences_json, JSON_OBJECT()), \'$.onboardingCompleted\', true) WHERE id = :user');
        $user->execute(['currency' => $currency, 'budget' => $monthlyBudget, 'user' => $userId]);
        $month = new DateTimeImmutable('first day of this month');
        $delete = $pdo->prepare('DELETE FROM budgets WHERE utilisateur_id = :user AND mois = :month AND annee = :year');
        $delete->execute(['user' => $userId, 'month' => (int) $month->format('m'), 'year' => (int) $month->format('Y')]);
        $findCategory = $pdo->prepare('SELECT id FROM categories WHERE slug = :slug LIMIT 1');
        $insertBudget = $pdo->prepare('INSERT INTO budgets (utilisateur_id, categorie_id, montant_limite, mois, annee) VALUES (:user, :category, :amount, :month, :year)');
        foreach ($normalizedAllocations as $slug => $amount) {
            if ($amount === 0) continue;
            $findCategory->execute(['slug' => $slug]);
            $categoryId = $findCategory->fetchColumn();
            if ($categoryId === false) moniError('INVALID_CATEGORY', 'Catégorie invalide.', 422);
            $insertBudget->execute(['user' => $userId, 'category' => $categoryId, 'amount' => $amount, 'month' => (int) $month->format('m'), 'year' => (int) $month->format('Y')]);
        }
        $pdo->prepare('DELETE FROM abonnements WHERE utilisateur_id = :user')->execute(['user' => $userId]);
        $findSubscriptionCategory = $pdo->prepare('SELECT id FROM categories WHERE slug = :slug LIMIT 1');
        $insertSubscription = $pdo->prepare('INSERT INTO abonnements (utilisateur_id, nom, montant_mensuel, jour_facturation, categorie_id) VALUES (:user, :name, :amount, :day, :category)');
        foreach ($normalizedSubscriptions as $subscription) {
            $categoryId = null;
            if ($subscription['includedIn'] !== null) {
                $findSubscriptionCategory->execute(['slug' => $subscription['includedIn']]);
                $categoryId = $findSubscriptionCategory->fetchColumn();
            }
            $insertSubscription->execute(['user' => $userId, 'name' => $subscription['name'], 'amount' => $subscription['amount'], 'day' => $subscription['billingDay'], 'category' => $categoryId]);
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
    moniSuccess(['state' => moniCurrentState($pdo, $userId)]);
});
