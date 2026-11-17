import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSavingsViewState, savingsDemoRequested } from '../../src/pages/savings.js';

test('active le rendu visuel Épargne uniquement avec le mode démo explicite', () => {
  assert.equal(savingsDemoRequested('#savings?demo=dashboard'), true);
  assert.equal(savingsDemoRequested('#savings'), false);
  assert.equal(savingsDemoRequested('#dashboard?demo=other'), false);
});

test('projette les deux objectifs et une épargne libre sans modifier la source', () => {
  const source = { currency: 'XOF', budget: 0, allocations: {}, subscriptions: [], transactions: [], goals: [], profile: {}, preferences: { language: 'fr' } };
  const view = createSavingsViewState(source, true);

  assert.equal(source.goals.length, 0);
  assert.equal(view.goals.length, 3);
  assert.equal(view.goals[0].target, 150000);
  assert.equal(view.goals[1].target, 300000);
  assert.equal(view.goals[2].contributions[0].amount, 25000);
});
