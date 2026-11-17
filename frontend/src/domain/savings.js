import { validAmount, sumAmounts } from './money.js';

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function savingsSummary(goal, today = new Date()) {
  if (goal.mode === 'free') {
    if (goal.contributions.some((item) => !validAmount(item.amount, false))) throw new RangeError('Contribution invalide.');
    return { saved: sumAmounts(goal.contributions.map((item) => item.amount)), remaining: null, periods: null, monthly: null, progress: null };
  }
  if (!validAmount(goal.target, false) || (goal.date && !validDate(goal.date))) throw new RangeError('Objectif invalide.');
  if (goal.contributions.some((item) => !validAmount(item.amount, false))) throw new RangeError('Contribution invalide.');
  const saved = sumAmounts(goal.contributions.map((item) => item.amount));
  const remaining = Math.max(0, goal.target - saved);
  if (!goal.date) return { saved, remaining, periods: null, monthly: null, progress: Number((BigInt(Math.min(saved, goal.target)) * 100n) / BigInt(goal.target)) };
  const target = new Date(goal.date + 'T00:00:00Z');
  const current = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  // Chaque mois civil entamé jusqu’à l’échéance compte comme une période.
  const periods = target < current ? 0 : (target.getUTCFullYear() - current.getUTCFullYear()) * 12 + target.getUTCMonth() - current.getUTCMonth() + 1;
  return { saved, remaining, periods, monthly: periods ? Number((BigInt(remaining) + BigInt(periods) - 1n) / BigInt(periods)) : null, progress: Number((BigInt(Math.min(saved, goal.target)) * 100n) / BigInt(goal.target)) };
}

export function totalSavings(goals) {
  return goals.reduce((total, goal) => {
    const saved = savingsSummary(goal).saved;
    if (total > Number.MAX_SAFE_INTEGER - saved) throw new RangeError('Total d’épargne trop élevé.');
    return total + saved;
  }, 0);
}
