import test from 'node:test';
import assert from 'node:assert/strict';
import { saveSubscription, removeSubscription, calculatePlannedTotal, monthlyDueDay } from '../../src/domain/subscriptions.js';
import { onboardingState, resetOnboardingState, serializeOnboarding } from '../../src/app/onboardingState.js';

test('ajoute, modifie et retire un abonnement sans doublon', () => {
  const entry = { name: 'Spotify', amount: 100, billingDay: 31, includedIn: null };
  let items = saveSubscription([], entry);
  assert.throws(() => saveSubscription(items, { ...entry, name: ' spotify ' }), /existe/);
  items = saveSubscription(items, { ...entry, amount: 200 }, 'Spotify');
  assert.equal(items[0].amount, 200);
  assert.deepEqual(removeSubscription(items, 'Spotify'), []);
});

test('valide les personnalisés, jours et montants', () => {
  assert.throws(() => saveSubscription([], { name: '', amount: 1, billingDay: 1 }), /nom/);
  assert.throws(() => saveSubscription([], { name: 'Service', amount: -1, billingDay: 1 }), /montant/);
  assert.throws(() => saveSubscription([], { name: 'Service', amount: 1, billingDay: 32 }), /jour/);
  assert.equal(saveSubscription([], { name: ' Théâtre ', amount: 0, billingDay: 29 })[0].name, 'Théâtre');
});

test('limite au dernier jour du mois, y compris les années bissextiles', () => {
  assert.equal(monthlyDueDay(2024, 2, 31), 29);
  assert.equal(monthlyDueDay(2023, 2, 29), 28);
  assert.equal(monthlyDueDay(2024, 4, 31), 30);
  assert.equal(monthlyDueDay(2100, 2, 30), 28);
  assert.throws(() => monthlyDueDay(2024, 13, 1), RangeError);
});

test('ne compte pas deux fois une charge liée et sérialise l’état', () => {
  const items = [{ name: 'A', amount: 50, billingDay: 1, includedIn: 'rent' }, { name: 'B', amount: 25, billingDay: 2, includedIn: null }];
  assert.equal(calculatePlannedTotal({ rent: 100 }, items), 125);
  resetOnboardingState();
  onboardingState.subscriptions = items;
  assert.deepEqual(serializeOnboarding().subscriptions, items);
  resetOnboardingState();
});
