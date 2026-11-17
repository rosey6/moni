import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_AMOUNT, MAX_TOTAL, sumAmounts, formatMoney, inputAmount } from '../../src/domain/money.js';
import { parseAmount } from '../../src/domain/budget.js';
import { savingsSummary, totalSavings } from '../../src/domain/savings.js';
import { transactionTotals } from '../../src/domain/transactions.js';

const goal = (amount) => ({ target: MAX_AMOUNT, date: '2030-12-31', contributions: [{ amount }] });
test('montants et totaux restent exacts aux limites, avec rejet avant addition', () => {
  assert.equal(parseAmount(String(MAX_AMOUNT), 0), MAX_AMOUNT);
  assert.equal(parseAmount(String(MAX_AMOUNT + 1), 0), null);
  assert.equal(sumAmounts([...Array(8).fill(MAX_AMOUNT), 7]), MAX_TOTAL);
  assert.throws(() => sumAmounts([...Array(8).fill(MAX_AMOUNT), 8]));
  assert.throws(() => sumAmounts([NaN]));
  assert.throws(() => transactionTotals([{type:'income', amount:-1}]));
  assert.equal(inputAmount(MAX_AMOUNT, 'EUR'), '11258999068426.23');
  assert.match(formatMoney(MAX_TOTAL, 'EUR'), /90[\s\u202f]071[\s\u202f]992[\s\u202f]547[\s\u202f]409,91/);
});
test('cumul des objectifs contrôlé, recalculé après suppression', () => {
  const goals = [...Array(8)].map(() => goal(MAX_AMOUNT));
  goals.push(goal(7));
  assert.equal(totalSavings(goals), MAX_TOTAL);
  goals.push(goal(1));
  assert.throws(() => totalSavings(goals));
  goals.pop(); goals.pop();
  assert.equal(totalSavings(goals), MAX_AMOUNT * 8);
  assert.throws(() => savingsSummary(goal(0)));
});

test('formatage exact et localisé sans conversion pour quatre devises', () => {
  assert.match(formatMoney(1234, 'XOF'), /1[\s\u202f]234/);
  assert.match(formatMoney(1234, 'XOF', 'code'), /XOF/);
  for (const currency of ['MAD', 'EUR', 'USD']) assert.match(formatMoney(1234, currency), /12,34/);
  assert.match(formatMoney(-1, 'EUR'), /-0,01/);
  globalThis.document = { documentElement: { lang: 'en' } };
  try { assert.match(formatMoney(1234, 'USD'), /12\.34/); }
  finally { delete globalThis.document; }
});
