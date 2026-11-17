import { createAuthPage } from './pages/auth.js';
import { createOnboardingPage } from './pages/onboarding.js';
import { onboardingSteps } from './app/onboardingState.js';
import { financeState } from './app/financeState.js';
import { t } from './app/i18n.js';
import { financeText as financeTr } from './app/i18nFinance.js';
import { createSubscriptionsPage } from './pages/subscriptions.js';
import { createDashboardPage } from './pages/dashboard.js';
import { createTransactionsPage } from './pages/transactions.js';
import { createBudgetsPage } from './pages/budgets.js';
import { createSavingsPage } from './pages/savings.js';
import { createProfilePage } from './pages/profile.js?v=20261115-one-click-toggle';
import { createPasswordRecoveryPage } from './pages/passwordRecovery.js';
import { createSubscriptionManagerPage } from './pages/subscriptionManager.js';
import { iconButton, logo, createBottomNav } from './components/financeUi.js';
import { createDashboardDemoState } from './app/dashboardDemoFixture.js';
import { logout, listNotifications, me } from './app/api.js';
import { createNotificationsPage } from './pages/notifications.js';
import { restoreSession } from './app/serverState.js';
import { resetFinanceState } from './app/financeState.js';

const app = document.querySelector('#app');
const welcome = app.cloneNode(true);
const financeRoutes = ['dashboard', 'transactions', 'transaction-edit', 'budgets', 'savings', 'goal-edit', 'profile', 'settings', 'privacy', 'subscriptions-manage', 'notifications'];
let resetToken = '';
let stopNavScroll = () => {};
let demoSession = false;
let notificationEvents = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {});
  }, { once: true });
}

function bindNavScroll(nav, content) {
  const mobileQuery = window.matchMedia('(max-width: 699px)');
  const readY = () => content.scrollTop;
  let previousY = readY();
  let direction = '';
  let distance = 0;
  let frame = 0;

  const setCompact = (compact) => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      nav.classList.toggle('is-compact', compact);
    });
  };

  const onScroll = () => {
    const currentY = readY();
    const delta = currentY - previousY;
    previousY = currentY;
    if (!mobileQuery.matches || nav.matches(':focus-within') || document.querySelector('dialog[open], [role="dialog"]:not([hidden])')) {
      direction = '';
      distance = 0;
      setCompact(false);
      return;
    }
    if (Math.abs(delta) < 1) return;
    const nextDirection = delta > 0 ? 'down' : 'up';
    if (nextDirection !== direction) {
      direction = nextDirection;
      distance = 0;
    }
    distance += Math.abs(delta);
    if (currentY <= 24) {
      direction = '';
      distance = 0;
      setCompact(false);
    } else if (direction === 'down' && distance >= 16) {
      setCompact(true);
    } else if (direction === 'up' && distance >= 8) {
      setCompact(false);
    }
  };
  const onFocus = () => {
    direction = '';
    distance = 0;
    setCompact(false);
  };
  const onResize = () => {
    if (!mobileQuery.matches) setCompact(false);
  };

  content.addEventListener('scroll', onScroll, { passive: true });
  nav.addEventListener('focusin', onFocus);
  window.addEventListener('resize', onResize, { passive: true });
  return () => {
    content.removeEventListener('scroll', onScroll);
    nav.removeEventListener('focusin', onFocus);
    window.removeEventListener('resize', onResize);
    if (frame) cancelAnimationFrame(frame);
  };
}

function renderFinance(route, state) {
  const visualRoute = route === 'transaction-edit' ? 'transactions' : route === 'goal-edit' ? 'savings' : ['settings', 'privacy'].includes(route) ? 'profile' : route;
  app.className = `finance-shell finance-shell--${visualRoute}`;
  app.removeAttribute('aria-labelledby');
  app.replaceChildren();

  const header = document.createElement('header');
  header.className = 'finance-header';
  header.append(logo());
  const actions = document.createElement('div');
  actions.className = 'finance-header__actions';
  const alertButton = iconButton(financeTr(state, 'Consulter les alertes'), 'bell', () => navigate('notifications'));
  alertButton.classList.add('notification-trigger');
  const updateBadge = data => {
    if (!alertButton.isConnected) return;
    const items = Array.isArray(data) ? data : data.notifications || [];
    const exact = !Array.isArray(data) && Number.isSafeInteger(data.unreadCount);
    const count = exact ? data.unreadCount : items.filter(item => !item.read).length;
    const label = String(count) + (!exact && items.length >= 100 ? '+' : '');
    alertButton.querySelector('.notification-badge')?.remove();
    if (count || (!exact && items.length >= 100)) { const badge = document.createElement('span'); badge.className = 'notification-badge'; badge.textContent = label; badge.setAttribute('aria-hidden', 'true'); alertButton.append(badge); }
    alertButton.setAttribute('aria-label', count || (!exact && items.length >= 100) ? financeTr(state, 'Consulter les alertes') + ` (${label})` : financeTr(state, 'Consulter les alertes'));
  };
  actions.append(alertButton, iconButton(financeTr(state, 'Profil'), 'user-round', () => navigate('profile')));
  header.append(actions);

  const content = document.createElement('main');
  content.className = 'finance-content';
  const nav = createBottomNav(state, route, navigate);
  app.append(header, content, nav);
  let badgeVersion = 0;
  if (!state.demoFixture) listNotifications().then(result => { if (!badgeVersion) updateBadge(result); }).catch(() => {});
  const onNotifications = event => { badgeVersion++; updateBadge(event.detail); };
  notificationEvents = new AbortController();
  window.addEventListener('moni:notifications-updated', onNotifications, { signal: notificationEvents.signal });
  stopNavScroll = bindNavScroll(nav, content);
  if (route === 'notifications') createNotificationsPage(content, state, navigate);
  else if (route === 'dashboard') createDashboardPage(content, state, navigate);
  else if (route === 'subscriptions-manage') createSubscriptionManagerPage(content, state, navigate);
  else if (['transactions', 'transaction-edit'].includes(route)) createTransactionsPage(content, state, navigate);
  else if (route === 'budgets') createBudgetsPage(content, state, navigate);
  else if (['savings', 'goal-edit'].includes(route)) createSavingsPage(content, state, navigate);
  else createProfilePage(content, state, navigate);
  document.title = 'Moni — ' + ({ dashboard: 'Accueil', transactions: 'Transactions', 'transaction-edit': 'Ajouter une transaction', budgets: 'Budgets', savings: 'Épargne', profile: 'Profil', settings: 'Paramètres', privacy: 'Confidentialité', 'subscriptions-manage': 'Abonnements' }[route] || 'Mon espace');
}

function render(route, demo = false) {
  stopNavScroll();
  notificationEvents?.abort();
  document.documentElement.lang = financeState.preferences.language;
  if (route === 'signup' || route === 'login') createAuthPage(app, route, navigate);
  else if (['forgot-password', 'forgot-password-sent', 'reset-password', 'reset-password-success'].includes(route)) createPasswordRecoveryPage(app, route, navigate, resetToken);
  else if (onboardingSteps.includes(route)) createOnboardingPage(app, route, navigate);
  else if (['subscriptions', 'subscription-edit', 'loading'].includes(route)) createSubscriptionsPage(app, route, navigate);
  else if (financeRoutes.includes(route)) renderFinance(route, demo ? createDashboardDemoState(financeState) : financeState);
  else {
    app.className = welcome.className;
    app.setAttribute('aria-labelledby', 'welcome-title');
    app.replaceChildren(...[...welcome.childNodes].map(node => node.cloneNode(true)));
    document.title = 'Moni — ' + t(financeState, 'welcome');
    app.querySelector('#welcome-title').textContent = t(financeState, 'welcome');
    app.querySelector('.welcome-copy > p:last-child').textContent = t(financeState, 'welcomeSubtitle');
    app.querySelector('[data-route=signup] span').textContent = t(financeState, 'createAccount');
    app.querySelector('[data-route=login] span').textContent = t(financeState, 'signIn');
  }
  const heading = app.querySelector('h1');
  if (heading) {
    document.title = 'Moni — ' + heading.textContent;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    if (document.activeElement === document.body || !app.contains(document.activeElement)) heading.focus({ preventScroll: true });
  }
}

function navigate(route) {
  if (route === 'logout') {
    logout().catch(() => {}).finally(() => resetFinanceState());
    resetFinanceState();
    route = '';
    demoSession = false;
  }
  const [target, query = ''] = route.split('?');
  const suffix = demoSession && target ? `${query ? '&' : '?'}demo=dashboard` : '';
  window.history.pushState({ route: target }, '', target ? `#${target}${query ? `?${query}` : ''}${suffix}` : location.pathname);
  render(target, demoSession);
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-route]');
  if (target) navigate(target.dataset.route);
});
window.addEventListener('popstate', renderLocation);
window.addEventListener('moni:session-expired', () => {
  resetFinanceState();
  if (!['', 'login', 'signup'].includes(location.hash.slice(1))) navigate('login');
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && financeState.profile?.id) me().catch(() => {});
});
function renderLocation() {
  let [route, query = ''] = location.hash.slice(1).split('?');
  demoSession = new URLSearchParams(query).get('demo') === 'dashboard';
  if (route === 'reset-password') {
    const candidate = new URLSearchParams(query).get('token');
    if (candidate) { resetToken = candidate; window.history.replaceState({}, '', '#reset-password'); }
  }
  if (!demoSession && financeState.profile?.id) {
    const destination = route === 'dashboard' && !financeState.onboardingCompleted
      ? 'currency'
      : onboardingSteps.includes(route) && financeState.onboardingCompleted
        ? 'dashboard'
        : route;
    if (destination !== route) {
      route = destination;
      window.history.replaceState({ route }, '', `#${route}`);
    }
  }
  render(route, demoSession);
}

const [initialRoute = '', initialQuery = ''] = location.hash.slice(1).split('?');
const initialDemo = new URLSearchParams(initialQuery).get('demo') === 'dashboard';
const initialPublic = ['', 'welcome', 'login', 'signup', 'forgot-password'].includes(initialRoute);
if (initialDemo || initialPublic) renderLocation();

restoreSession(financeState)
  .catch((exception) => {
    if (exception.status !== 401) financeState.serverLoadError = exception;
  })
  .finally(() => { if (!initialDemo && !initialPublic) renderLocation(); });
