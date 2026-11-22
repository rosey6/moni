const CACHE_NAME = 'moni-static-custom-subscription-flow-20261122';
const CACHE_PREFIX = 'moni-static-';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/src/main.js?v=custom-subscription-flow-20261122',
  '/src/pages/profile.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/subscriptions.js?v=custom-subscription-flow-20261122',
  '/src/pages/subscriptionManager.js?v=full-i18n-savingsfix-20261122',
  '/src/components/financeUi.js?v=full-i18n-savingsfix-20261122',
  '/src/app/i18nFinance.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/subscriptions.js?v=custom-subscription-flow-20261122',
  '/src/app/i18nEarly.js?v=subscription-sequence-20261122',
  '/src/main.js?v=custom-subscription-flow-20261122',
  '/src/app/api.js',
  '/src/app/pushActivation.js',
  '/src/pages/notifications.js?v=full-i18n-savingsfix-20261122',
  '/src/styles/notifications.css',
  '/src/app/dashboardDemoFixture.js',
  '/src/app/financeState.js',
  '/src/app/i18n.js',
  '/src/app/i18nEarly.js',
  '/src/app/i18nFinance.js?v=full-i18n-savingsfix-20261122',
  '/src/app/onboardingState.js',
  '/src/app/serverState.js',
  '/src/components/donut.js',
  '/src/components/financeUi.js?v=full-i18n-savingsfix-20261122',
  '/src/components/formField.js',
  '/src/components/icon.js',
  '/src/domain/budget.js',
  '/src/domain/budgets.js',
  '/src/domain/money.js',
  '/src/domain/notifications.js',
  '/src/domain/savings.js',
  '/src/domain/subscriptions.js',
  '/src/domain/transactions.js',
  '/src/domain/validation.js',
  '/src/pages/auth.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/budgets.js?v=budget-summary-20261122',
  '/src/pages/dashboard.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/onboarding.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/passwordRecovery.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/profile.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/savings.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/subscriptionManager.js?v=full-i18n-savingsfix-20261122',
  '/src/pages/subscriptions.js?v=custom-subscription-flow-20261122',
  '/src/pages/transactions.js?v=full-i18n-savingsfix-20261122',
  '/src/styles/auth.css',
  '/src/styles/base.css',
  '/src/styles/finance.css?v=full-i18n-profilefix-20261122',
  '/src/styles/onboarding.css',
  '/src/styles/profile.css',
  '/src/styles/subscriptions.css',
  '/src/styles/tokens.css',
  '/src/styles/welcome.css',
  '/vendor/lucide-icons.mjs',
  '/src/components/fontAwesome.js',
  '/public/assets/brand/moni-organique.png',
  '/public/icons/moni-organique-192.png',
  '/public/icons/moni-organique-512.png',
  '/public/icons/moni-organique-512-maskable.png',
  '/public/assets/mascots/validated/01-bienvenue.webp',
  '/public/assets/mascots/validated/02-connexion.webp',
  '/public/assets/mascots/validated/03-inscription.webp',
  '/public/assets/mascots/validated/04-devise.webp',
  '/public/assets/mascots/validated/05-budget-mensuel.webp',
  '/public/assets/mascots/validated/06-loyer.webp',
  '/public/assets/mascots/validated/07-transport.webp',
  '/public/assets/mascots/validated/08-courses.webp',
  '/public/assets/mascots/validated/09-imprevus.webp',
  '/public/assets/mascots/validated/10-abonnements.webp',
  '/public/assets/mascots/validated/11-chargement.webp',
  '/public/assets/mascots/validated/12-statistiques.webp',
  '/public/assets/mascots/validated/13-epargne.webp',
  '/public/assets/flags/mad.svg',
  '/public/assets/flags/eur.svg',
  '/public/assets/flags/usd.svg',
  '/public/assets/flags/xof.svg',
  '/public/assets/flags/gb.svg',
  '/public/assets/flags/ca.svg',
  '/public/assets/flags/ch.svg',
  '/public/assets/flags/jp.svg',
  '/public/assets/flags/cn.svg',
  '/public/assets/flags/ae.svg',
  '/public/assets/flags/au.svg',
  '/public/assets/flags/br.svg',
  '/public/assets/flags/in.svg',
  '/public/assets/flags/ng.svg',
  '/public/assets/flags/za.svg',
  '/public/assets/flags/tr.svg',
  '/public/assets/brands/netflix.svg',
  '/public/assets/brands/canva.svg',
  '/public/assets/brands/orange.svg',
  '/public/assets/brands/inwi.svg',
  '/public/assets/brands/maroc-telecom.svg',
  '/public/assets/savings/moni_epargne_libre.png',
  '/public/assets/savings/moni_epargne_objectif.png'
];

function isPrivateApi(url) {
  return url.origin !== self.location.origin || url.pathname.startsWith('/backend/');
}

async function cacheResponse(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'CLEAR_MONI_CACHES') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX)).map(key => caches.delete(key)))));
  }
});

const PUSH_DESTINATIONS = new Set(['dashboard', 'transactions', 'budgets', 'savings', 'subscriptions-manage', 'profile', 'notifications']);

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Invalid payloads use the neutral notification. */ }
  const route = PUSH_DESTINATIONS.has(payload.route) ? payload.route : 'dashboard';
  event.waitUntil(self.registration.showNotification('Moni', {
    body: 'Tu as une nouvelle notification.',
    icon: '/public/icons/moni-organique-192.png',
    data: { route },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const route = PUSH_DESTINATIONS.has(event.notification.data?.route) ? event.notification.data.route : 'dashboard';
  const destination = new URL(`/index.html#${route}`, self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find(client => { const url = new URL(client.url); return url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html'); });
    if (existing) {
      const navigated = await existing.navigate(destination);
      if (navigated) return navigated.focus();
    }
    return self.clients.openWindow(destination);
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || isPrivateApi(url) || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => cacheResponse(new Request('/index.html'), response)).catch(() => caches.match('/index.html')));
    return;
  }

  if (url.search && (url.searchParams.size !== 1 || !url.searchParams.has('v'))) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.search) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => cacheResponse(request, response))));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => cacheResponse(request, response)))
  );
});
