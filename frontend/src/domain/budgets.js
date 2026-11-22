import { validAmount, sumAmounts } from './money.js';
import { calculatePlannedTotal } from './subscriptions.js';

export const budgetCategories = { rent: 'Loyer', transport: 'Transport', groceries: 'Courses', unexpected: 'Imprévus' };

export function summarizeBudgets(state, month) {
  const items = Object.entries(state.allocations).map(([category, limit]) => {
    const spent = sumAmounts(state.transactions.filter((item) => item.type === 'expense' && item.category === category && item.date.startsWith(month)).map((item) => item.amount));
    const linked = sumAmounts(state.subscriptions.filter((item) => item.includedIn === category).map((item) => item.amount));
    if (!validAmount(limit)) throw new RangeError('Montants invalides.');
    return { category, limit, spent, linked, exceeded: spent > limit, linkedExceeded: linked > limit };
  });
  const allocated = sumAmounts(items.map((item) => item.limit));
  return { items, allocated, planned: calculatePlannedTotal(state.allocations, state.subscriptions) };
}

export function removeBudget(state, category) {
  delete state.allocations[category];
  state.subscriptions = state.subscriptions.map((item) => item.includedIn === category ? { ...item, includedIn: null } : item);
}
