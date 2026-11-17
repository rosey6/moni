import { getPushConfig, registerPushDevice } from './api.js';

export const FRONTEND_VERSION = '2026.11.15-ios-push-activation-1';

export function pushApplicationServerKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{80,100}$/.test(key)) throw new Error('Configuration VAPID invalide.');
  const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export function isIOSWebApp() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && (navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches);
}

export async function preparePushActivation() {
  const result = { config: null, registration: null, subscription: null, error: '' };
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    result.error = 'Notifications incompatibles avec cet appareil ou ce contexte.';
    return result;
  }
  const [config, registration] = await Promise.allSettled([
    getPushConfig(),
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready)
  ]);
  if (config.status === 'fulfilled') result.config = config.value;
  if (registration.status === 'fulfilled') result.registration = registration.value;
  if (!result.config) result.error = config.reason?.message || 'Configuration VAPID indisponible.';
  else if (!result.config.enabled || !result.config.publicKey) result.error = 'Notifications push désactivées sur ce serveur.';
  if (!result.registration) result.error ||= registration.reason?.message || 'Service Worker indisponible.';
  if (result.registration) {
    try { result.subscription = await result.registration.pushManager.getSubscription(); }
    catch (error) { result.error ||= error.message || 'Abonnement de cet appareil indisponible.'; }
  }
  return result;
}

export function registerPreparedPushSubscription(subscription) {
  return registerPushDevice({
    subscription: subscription.toJSON(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}
