import { createAuthPage } from './pages/auth.js';
import { createOnboardingPage } from './pages/onboarding.js';
import { onboardingSteps } from './app/onboardingState.js';
import { createSubscriptionsPage } from './pages/subscriptions.js';

const app = document.querySelector('#app');
const welcome = app.cloneNode(true);

function navigate(route) {
  if (route === 'signup' || route === 'login' || onboardingSteps.includes(route) || ['subscriptions', 'subscription-edit', 'loading'].includes(route)) {
    window.history.pushState({ route }, '', `#${route}`);
    if (route === 'signup' || route === 'login') createAuthPage(app, route, navigate);
    else if (onboardingSteps.includes(route)) createOnboardingPage(app, route, navigate);
    else createSubscriptionsPage(app, route, navigate);
  }
}

document.addEventListener('click', (event) => {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) navigate(routeTarget.dataset.route);
});

window.addEventListener('popstate', () => {
  const route = window.location.hash.slice(1);
  if (route === 'signup' || route === 'login') createAuthPage(app, route, navigate);
  else if (onboardingSteps.includes(route)) createOnboardingPage(app, route, navigate);
  else if (['subscriptions', 'subscription-edit', 'loading'].includes(route)) createSubscriptionsPage(app, route, navigate);
  else {
    app.className = welcome.className;
    app.setAttribute('aria-labelledby', 'welcome-title');
    app.replaceChildren(...[...welcome.childNodes].map((node) => node.cloneNode(true)));
    document.title = 'Moni — Bienvenue';
  }
});

const initialRoute = window.location.hash.slice(1);
if (initialRoute === 'signup' || initialRoute === 'login') createAuthPage(app, initialRoute, navigate);
else if (onboardingSteps.includes(initialRoute)) createOnboardingPage(app, initialRoute, navigate);
else if (['subscriptions', 'subscription-edit', 'loading'].includes(initialRoute)) createSubscriptionsPage(app, initialRoute, navigate);
