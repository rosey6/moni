export const categoryColors = {
  rent: '#ff6956',
  transport: '#ffd52f',
  groceries: '#48d9be',
  unexpected: '#a875e8',
};

export function calculateBudget(budget, allocations) {
  if (![budget, ...Object.values(allocations)].every((amount) => Number.isSafeInteger(amount) && amount >= 0) || !Number.isSafeInteger(Object.values(allocations).reduce((sum, amount) => sum + amount, 0))) throw new RangeError('Montants monétaires invalides.');
  const totalAllocated = Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
  return {
    totalAllocated,
    remaining: budget - totalAllocated,
    exceedsBudget: totalAllocated > budget,
  };
}

export function getDonutSegments(budget, allocations) {
  const summary = calculateBudget(budget, allocations);
  if (budget <= 0) return [{ key: 'empty', value: 1, color: '#d9d9df' }];
  if (summary.totalAllocated === 0) return [{ key: 'budget', value: budget, color: Object.keys(allocations).length ? '#d9d9df' : '#00c8ad' }];
  const segments = Object.entries(allocations)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => ({ key, value: amount, color: categoryColors[key] }));
  if (summary.remaining > 0) segments.push({ key: 'remaining', value: summary.remaining, color: '#d9d9df' });
  return segments.length ? segments : [{ key: 'remaining', value: budget, color: '#48d9be' }];
}

export function parseAmount(rawValue, digits = 0) {
  const value = String(rawValue).trim();
  const parts = value.replace(',', '.').split('.');
  if (parts.length > 2 || !/^\d+$/.test(parts[0]) || (parts.length === 2 && (!/^\d+$/.test(parts[1]) || parts[1].length > digits))) return null;
  const amount = Number(parts[0] + (parts[1] || '').padEnd(digits, '0'));
  return Number.isSafeInteger(amount) && amount <= Math.floor(Number.MAX_SAFE_INTEGER / 8) ? amount : null;
}
