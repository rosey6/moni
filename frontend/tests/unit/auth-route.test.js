import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authLandingRoute } from '../../src/pages/auth.js';

test('redirige un compte existant vers le dashboard, un compte incomplet vers l’onboarding', () => {
  assert.equal(authLandingRoute(false, { onboardingCompleted: true }), 'dashboard');
  assert.equal(authLandingRoute(false, { onboardingCompleted: false }), 'currency');
  assert.equal(authLandingRoute(true, { onboardingCompleted: true }), 'currency');
});
