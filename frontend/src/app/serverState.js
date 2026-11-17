import { me } from './api.js';

export function applyServerState(state, data = {}) {
  if (data.currency) state.currency = data.currency;
  if (Number.isSafeInteger(data.availableBalance)) state.availableBalance = data.availableBalance;
  if (typeof data.savingsAffectAvailableBalance === 'boolean') state.savingsAffectAvailableBalance = data.savingsAffectAvailableBalance;
  if (typeof data.onboardingCompleted === 'boolean') state.onboardingCompleted = data.onboardingCompleted;
  if (Number.isSafeInteger(data.budget)) state.budget = data.budget;
  if (data.allocations && typeof data.allocations === 'object') state.allocations = { ...data.allocations };
  if (Array.isArray(data.subscriptions)) state.subscriptions = data.subscriptions;
  if (Array.isArray(data.transactions)) state.transactions = data.transactions;
  if (Array.isArray(data.goals)) state.goals = data.goals;
  if (data.profile) state.profile = data.profile;
  if (data.preferences) state.preferences = data.preferences;
  return state;
}

export function applyAuthResult(state, result) {
  if (result.state) applyServerState(state, result.state);
  if (result.user) state.profile = { ...state.profile, ...result.user };
  state.serverLoadError = null;
  return state;
}

export async function restoreSession(state) {
  const result = await me();
  applyAuthResult(state, result);
  return state;
}

export function resetRemoteUiState(state) {
  state.dashboardAmountsVisible = false;
  state.readNotifications = [];
  state.preferences = { language: 'fr', alerts: { budget: true, subscriptions: true, savings: true } };
}
