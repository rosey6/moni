import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardDemoState, dashboardDemoFixture, isDashboardDemoState } from '../../src/app/dashboardDemoFixture.js';
import { transactionTotals } from '../../src/domain/transactions.js';
import { totalSavings } from '../../src/domain/savings.js';

test('la fixture Dashboard est isolée et arithmétiquement cohérente', () => {
  const realState = { currency: 'EUR', budget: 12, allocations: { rent: 12 }, transactions: [], subscriptions: [], goals: [], profile: { name: '' }, preferences: { language: 'fr' } };
  const demo = createDashboardDemoState(realState);
  assert.equal(isDashboardDemoState(demo), true);
  assert.equal(isDashboardDemoState(realState), false);
  assert.equal(realState.budget, 12);
  assert.deepEqual(transactionTotals(demo.transactions), { income: 250000, expense: 123500 });
  assert.equal(totalSavings(demo.goals), 85000);
  assert.equal(demo.dashboardBalance + transactionTotals(demo.transactions).expense, 250000);
  assert.equal(demo.dashboardVisibleTransactionIds.length, 5);
  assert.equal(dashboardDemoFixture.dashboardBudgetProgress, 81);
  assert.equal(demo.allocations.rent + demo.allocations.transport + demo.allocations.groceries + demo.allocations.unexpected, 200000);
});
