import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBudgets, removeBudget } from '../../src/domain/budgets.js';

const data = () => ({ budget: 1000, allocations: { rent: 500, groceries: 0 }, subscriptions: [{ amount: 300, includedIn: 'rent' }, { amount: 250, includedIn: 'rent' }, { amount: 100, includedIn: null }], transactions: [{ type: 'expense', category: 'rent', amount: 600, date: '2026-11-03' }, { type: 'income', category: 'rent', amount: 100, date: '2026-11-04' }, { type: 'expense', category: 'rent', amount: 50, date: '2026-10-04' }] });
test('distingue dépenses, allocations et abonnements liés', () => {
  const state = data();
  const result = summarizeBudgets(state, '2026-11');
  assert.equal(result.allocated, 500);
  assert.equal(result.planned, 600);
  assert.deepEqual(result.items[0], { category: 'rent', limit: 500, spent: 600, linked: 550, exceeded: true, linkedExceeded: true });
  assert.equal(result.items[1].exceeded, false);
  state.allocations.rent = 700;
  assert.equal(summarizeBudgets(state, '2026-11').items[0].exceeded, false);
});
test('supprime une enveloppe et détache les abonnements en conservant les transactions', () => {
  const state = data();
  const transactions = state.transactions;
  removeBudget(state, 'rent');
  assert.equal(Object.hasOwn(state.allocations, 'rent'), false);
  assert.deepEqual(state.subscriptions.map(({ includedIn }) => includedIn), [null, null, null]);
  assert.equal(state.transactions, transactions);
  removeBudget(state, 'groceries');
  assert.equal(summarizeBudgets(state, '2026-11').items.length, 0);
});
