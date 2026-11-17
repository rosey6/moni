import { onboardingState, resetOnboardingState } from './onboardingState.js';

export const financeState = onboardingState;
const fields = ['budget', 'allocations', 'subscriptions', 'transactions', 'goals', 'validatedSteps'];
let spaces = new Map();
export function switchCurrency(state, currency) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError('Devise non prise en charge.');
  new Intl.NumberFormat('fr', { style: 'currency', currency });
  if (currency === state.currency) return;
  spaces.set(state.currency, Object.fromEntries(fields.map(key => [key, state[key]])));
  const next = spaces.get(currency) || { budget: 0, allocations: { rent: 0, transport: 0, groceries: 0, unexpected: 0 }, subscriptions: [], transactions: [], goals: [], validatedSteps: [] };
  Object.assign(state, next, { currency });
}
export function resetFinanceState() {
  resetOnboardingState(); spaces = new Map();
  financeState.transactions = []; financeState.goals = [];
  financeState.profile = { name: '', email: '' };
  financeState.serverLoadError = null;
  financeState.readNotifications = [];
  financeState.preferences = { language: 'fr', alerts: { budget: true, subscriptions: true, savings: true } };
}
financeState.transactions = [];
financeState.goals = [];
financeState.profile = { name: '', email: '' };
financeState.serverLoadError = null;
financeState.preferences = { language: 'fr', alerts: { budget: true, subscriptions: true, savings: true } };
