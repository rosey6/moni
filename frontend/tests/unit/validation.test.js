import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLogin, validateSignup } from '../../src/domain/validation.js';
import { calculateBudget, getDonutSegments, parseAmount } from '../../src/domain/budget.js';
import { formatMoney } from '../../src/domain/money.js';
import { onboardingState, resetOnboardingState, serializeOnboarding } from '../../src/app/onboardingState.js';

test('valide une inscription complète', () => {
  assert.deepEqual(validateSignup({ fullName: 'Awa Diallo', email: 'awa@example.com', password: 'budget123', confirmPassword: 'budget123', privacyAccepted: 'on' }), {});
});

test('signale les erreurs d’inscription', () => {
  const errors = validateSignup({ fullName: '', email: 'awa', password: 'court', confirmPassword: 'different' });
  assert.equal(errors.fullName, 'Indique ton nom complet.');
  assert.equal(errors.email, 'Saisis une adresse e-mail valide.');
  assert.equal(errors.password, 'Le mot de passe doit contenir au moins 8 caractères.');
  assert.equal(errors.confirmPassword, 'Les mots de passe ne correspondent pas.');
  assert.equal(errors.privacyAccepted, 'Accepte la politique de confidentialité pour créer ton compte.');
});

test('valide et rejette une connexion', () => {
  assert.deepEqual(validateLogin({ email: 'awa@example.com', password: 'secret' }), {});
  assert.deepEqual(validateLogin({ email: '', password: '' }), { email: 'Saisis une adresse e-mail valide.', password: 'Saisis ton mot de passe.' });
});

test('gère un budget nul et une saisie invalide', () => {
  assert.deepEqual(calculateBudget(0, { rent: 0, transport: 0, groceries: 0, unexpected: 0 }), { totalAllocated: 0, remaining: 0, exceedsBudget: false });
  assert.equal(parseAmount('-10'), null);
  assert.equal(parseAmount('12.5'), null);
  assert.equal(parseAmount(''), null);
});

test('signale un dépassement et conserve les catégories ignorées à zéro', () => {
  const allocations = { rent: 120000, transport: 0, groceries: 45000, unexpected: 0 };
  const result = calculateBudget(150000, allocations);
  assert.equal(result.totalAllocated, 165000);
  assert.equal(result.exceedsBudget, true);
  assert.equal(getDonutSegments(150000, allocations).length, 2);
});

test('formate les devises prises en charge', () => {
  assert.match(formatMoney(250000, 'XOF'), /250\s?000/);
  assert.match(formatMoney(120000, 'MAD'), /1\s?200,00/);
  assert.match(formatMoney(300, 'EUR'), /3,00/);
  assert.match(formatMoney(500, 'USD'), /5,00/);
});

test('convertit la saisie décimale en unités mineures exactes', () => {
  assert.equal(parseAmount('0,10', 2), 10);
  assert.equal(parseAmount('12.34', 2), 1234);
  assert.equal(parseAmount('12.345', 2), null);
  assert.equal(parseAmount('1.5', 0), null);
  assert.equal(parseAmount('9007199254740992'), null);
});

test('recalcule les proportions après modification et refus des montants invalides', () => {
  assert.throws(() => calculateBudget(-1, {}), RangeError);
  assert.throws(() => calculateBudget(100, { rent: 0.1 }), RangeError);
  assert.equal(getDonutSegments(0, {}).length, 1);
  assert.deepEqual(getDonutSegments(100, { rent: 25 }).map(({ value }) => value), [25, 75]);
  assert.equal(calculateBudget(100, { rent: 50 }).remaining, 50);
});

test('sérialise uniquement les montants prévus en mémoire', () => {
  resetOnboardingState();
  onboardingState.currency = 'MAD';
  onboardingState.budget = 100000;
  onboardingState.allocations.rent = 1234;
  const payload = JSON.parse(JSON.stringify(serializeOnboarding()));
  assert.equal(payload.plannedAllocations[0].amount, 1234);
  assert.equal(payload.currency, 'MAD');
  resetOnboardingState();
});
