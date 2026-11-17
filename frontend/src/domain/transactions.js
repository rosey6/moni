import { validAmount, sumAmounts } from './money.js';

export const expenseCategories = { rent: 'Loyer', transport: 'Transport', groceries: 'Courses', unexpected: 'Imprévus' };
export const incomeCategories = { salary: 'Salaire', scholarship: 'Bourse d’études', family_support: 'Aide familiale', freelance: 'Freelance', other_income: 'Autres revenus' };
export const transactionCategories = { ...expenseCategories, ...incomeCategories };

export function validTransaction(entry) {
  if (!['expense', 'income'].includes(entry.type) || !validAmount(entry.amount, false)) return false;
  const categories = entry.type === 'income' ? incomeCategories : expenseCategories;
  if (!Object.hasOwn(categories, entry.category) && !(entry.type === 'income' && Object.hasOwn(expenseCategories, entry.category)) || typeof entry.description !== 'string' || entry.description.length > 200) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false;
  const date = new Date(`${entry.date}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === entry.date;
}

export function saveTransaction(items, entry) {
  if (!entry.id || !validTransaction(entry)) throw new Error('Vérifie le montant, la catégorie et la date.');
  if (items.some((item) => item.id !== entry.id && ['type', 'amount', 'category', 'date', 'description'].every((key) => item[key] === entry[key]))) throw new Error('Une transaction identique existe déjà.');
  return [...items.filter((item) => item.id !== entry.id), { ...entry }];
}

export function filterTransactions(items, { type = 'all', month = '', search = '' } = {}) {
  const query = search.trim().toLocaleLowerCase('fr');
  return items.filter((item) => (type === 'all' || item.type === type) && (!month || item.date.startsWith(month + '-')) && (!query || `${item.description} ${transactionCategories[item.category]}`.toLocaleLowerCase('fr').includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function transactionTotals(items) {
  if (items.some((item) => !['income', 'expense'].includes(item.type) || !validAmount(item.amount, false))) throw new RangeError('Transaction invalide.');
  return {
    income: sumAmounts(items.filter((item) => item.type === 'income').map((item) => item.amount)),
    expense: sumAmounts(items.filter((item) => item.type === 'expense').map((item) => item.amount)),
  };
}
