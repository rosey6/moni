export function saveSubscription(items, entry, previousName = null) {
  const name = entry.name.trim();
  if (!name || name.length > 80) throw new Error('Indique un nom de service valide.');
  if (!Number.isSafeInteger(entry.amount) || entry.amount < 0) throw new Error('Indique un montant valide.');
  if (!Number.isInteger(entry.billingDay) || entry.billingDay < 1 || entry.billingDay > 31) throw new Error('Choisis un jour valide.');
  if (entry.includedIn && !['rent', 'transport', 'groceries', 'unexpected'].includes(entry.includedIn)) throw new Error('Allocation invalide.');
  const key = name.toLocaleLowerCase('fr');
  if (items.some((item) => item.name.toLocaleLowerCase('fr') === key && item.name !== previousName)) throw new Error('Cet abonnement existe déjà.');
  const updated = items.filter((item) => item.name !== previousName);
  return [...updated, { name, amount: entry.amount, billingDay: entry.billingDay, includedIn: entry.includedIn || null }];
}

export function removeSubscription(items, name) {
  return items.filter((item) => item.name !== name);
}

// Les abonnements liés sont inclus dans leur allocation et ne sont pas ajoutés au total.
export function calculatePlannedTotal(allocations, subscriptions) {
  const amounts = [...Object.values(allocations), ...subscriptions.filter((item) => !item.includedIn).map((item) => item.amount)];
  if (!amounts.every((amount) => Number.isSafeInteger(amount) && amount >= 0)) throw new RangeError('Montants invalides.');
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total)) throw new RangeError('Total trop élevé.');
  return total;
}

export function monthlyDueDay(year, month, billingDay) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) throw new RangeError('Date invalide.');
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return Math.min(billingDay, [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]);
}
