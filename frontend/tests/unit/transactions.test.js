import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveTransaction, filterTransactions, transactionTotals } from '../../src/domain/transactions.js';
const first = { id: '1', type: 'expense', amount: 1250, category: 'groceries', date: '2026-02-28', description: 'Courses' };
const income = { id: '2', type: 'income', amount: 5000, category: 'unexpected', date: '2026-03-01', description: 'Bourse' };
test('crée, modifie et supprime sans doubler les transactions', () => {
  let items = saveTransaction([], first);
  items = saveTransaction(items, income);
  items = saveTransaction(items, { ...first, amount: 1500 });
  assert.deepEqual(transactionTotals(items), { expense: 1500, income: 5000 });
  assert.throws(() => saveTransaction(items, { ...income, id: '3' }), /identique/);
  items = items.filter((item) => item.id !== '1');
  assert.deepEqual(transactionTotals(items), { expense: 0, income: 5000 });
});
test('rejette montants et dates invalides', () => {
  for (const entry of [{ ...first, amount: -1 }, { ...first, amount: 0 }, { ...first, amount: 1.2 }, { ...first, date: '2026-02-30' }, { ...first, category: '__proto__' }]) assert.throws(() => saveTransaction([], entry));
});
test('filtre et trie les résultats, y compris le vide', () => {
  const items = [first, income];
  assert.equal(filterTransactions(items)[0].id, '2');
  assert.deepEqual(filterTransactions(items, { type: 'expense', month: '2026-02', search: 'COURSES' }), [first]);
  assert.deepEqual(filterTransactions(items, { month: '2025-01' }), []);
});
