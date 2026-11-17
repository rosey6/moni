const defaultBase = typeof location !== 'undefined' && location.port === '4173' ? 'http://127.0.0.1:8080' : '/backend';
const API_BASE = (globalThis.MONI_API_BASE || defaultBase).replace(/\/$/, '');
let csrfToken = '';

function errorFrom(response, payload) {
  const error = payload?.error || {};
  const exception = new Error(error.message || `Erreur serveur (${response.status}).`);
  exception.code = error.code || 'HTTP_ERROR';
  exception.status = response.status;
  return exception;
}

export async function apiRequest(path, { method = 'GET', body, query = {} } = {}) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  const url = `${API_BASE}/${path}${params.size ? `?${params}` : ''}`;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  let response;
  try {
    response = await fetch(url, { method, credentials: 'include', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error('Serveur Moni inaccessible. Vérifie sa configuration.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('moni:session-expired'));
    throw errorFrom(response, payload);
  }
  if (payload.data?.csrfToken) csrfToken = payload.data.csrfToken;
  return payload.data || {};
}

export function setCsrfToken(token) {
  csrfToken = typeof token === 'string' ? token : '';
}

export function clearMoniServiceWorkerCaches() {
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_MONI_CACHES' });
}

export const privacyPolicyUrl = `${API_BASE}/privacy-policy.php`;
export const getPrivacyPolicy = () => apiRequest('privacy-policy.php', { query: { format: 'json' } });
export const register = body => apiRequest('register.php', { method: 'POST', body });
export const login = body => apiRequest('login.php', { method: 'POST', body });
export const forgotPassword = body => apiRequest('forgot-password.php', { method: 'POST', body });
export const resetPassword = body => apiRequest('reset-password.php', { method: 'POST', body });
export const logout = async () => {
  const result = await apiRequest('logout.php', { method: 'POST', body: {} });
  clearMoniServiceWorkerCaches();
  return result;
};
export const me = () => apiRequest('me.php');
export const saveOnboarding = body => apiRequest('onboarding.php', { method: 'PUT', body });
export const saveProfile = body => apiRequest('profile.php', { method: 'PATCH', body });
export const getSubscriptions = () => apiRequest('subscriptions.php');
export const createSubscription = body => apiRequest('subscriptions.php', { method: 'POST', body });
export const updateSubscription = (id, body) => apiRequest('subscriptions.php', { method: 'PATCH', body: { ...body, id }, query: { id } });
export const deleteSubscription = id => apiRequest('subscriptions.php', { method: 'DELETE', body: { id } });
export const syncNotifications = notifications => apiRequest('notifications.php', { method: 'POST', body: { notifications } });
export const listNotifications = (query = {}) => apiRequest('notifications.php', { query });
export const markNotificationRead = id => apiRequest('notifications.php', { method: 'PATCH', body: { id } });
export const markAllNotificationsRead = () => apiRequest('notifications.php', { method: 'PATCH', body: { action: 'read_all' } });
export const getPushConfig = () => apiRequest('push-config.php');
export const getPushStatus = () => apiRequest('push-subscriptions.php');
export const registerPushDevice = body => apiRequest('push-subscriptions.php', { method: 'POST', body });
export const revokePushDevice = deviceId => apiRequest('push-subscriptions.php', { method: 'DELETE', body: deviceId ? { deviceId } : {} });
export const sendPushTest = () => apiRequest('push-test.php', { method: 'POST', body: {} });
export const createTransaction = body => apiRequest('transactions.php', { method: 'POST', body });
export const updateTransaction = (id, body) => apiRequest('transactions.php', { method: 'PATCH', body: { ...body, id }, query: { id } });
export const deleteTransaction = id => apiRequest('transactions.php', { method: 'DELETE', query: { id }, body: {} });
export const createGoal = body => apiRequest('savings.php', { method: 'POST', body });
export const updateGoal = (id, body) => apiRequest('savings.php', { method: 'PATCH', body: { ...body, id }, query: { id } });
export const deleteGoal = id => apiRequest('savings.php', { method: 'DELETE', body: { id } });
export const saveContribution = body => apiRequest('savings.php', { method: body.id ? 'PATCH' : 'POST', body: { ...body, contribution: true } });
export const deleteContribution = (goalId, id) => apiRequest('savings.php', { method: 'DELETE', body: { contribution: true, goalId, id } });
