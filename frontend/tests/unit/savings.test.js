import { test } from 'node:test';
import assert from 'node:assert/strict';
import { savingsSummary, validDate } from '../../src/domain/savings.js';
const today = new Date(2026, 10, 2);
test('calcule les périodes, le restant et arrondit au supérieur', () => {
  assert.deepEqual(savingsSummary({ target: 100, date: '2027-01-10', contributions: [{ amount: 1 }] }, today), { saved: 1, remaining: 99, periods: 3, monthly: 33, progress: 1 });
  assert.equal(savingsSummary({ target: 100, date: '2026-12-01', contributions: [{ amount: 1 }] }, today).monthly, 50);
});
test('gère échéance dépassée, objectif atteint et montants invalides', () => {
  assert.deepEqual(savingsSummary({ target: 100, date: '2026-10-01', contributions: [{ amount: 120 }] }, today), { saved: 120, remaining: 0, periods: 0, monthly: null, progress: 100 });
  assert.throws(() => savingsSummary({ target: 0, date: '2026-11-03', contributions: [] }, today));
  assert.throws(() => savingsSummary({ target: 100, date: '2026-11-03', contributions: [{ amount: 0 }] }, today));
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
});
test('gère une épargne libre sans cible ni date', () => {
  assert.deepEqual(savingsSummary({ mode: 'free', target: null, date: null, contributions: [{ amount: 45000 }] }), { saved: 45000, remaining: null, periods: null, monthly: null, progress: null });
});
test('permet un objectif sans date cible sans inventer de durée', () => {
  assert.deepEqual(savingsSummary({ mode: 'goal', target: 100, date: null, contributions: [{ amount: 25 }] }, today), { saved: 25, remaining: 75, periods: null, monthly: null, progress: 25 });
});
