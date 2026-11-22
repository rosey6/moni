import { financeText as tr } from '../app/i18nFinance.js?v=full-i18n-profilefix-20261122';
import { createIcon } from './icon.js';

const iconAliases = {
  home: 'house', list: 'list', chart: 'chart-no-axes-column-increasing', coins: 'coins', user: 'user-round',
  arrowDown: 'trending-up', arrowUp: 'trending-down', 'arrow-up': 'arrow-left', 'arrow-down': 'arrow-left', calendar: 'calendar-days', sliders: 'sliders-horizontal',
  chevron: 'chevron-right', back: 'arrow-left', cart: 'shopping-cart', bus: 'bus-front', wallet: 'wallet-cards',
  shield: 'shield-check', logout: 'log-out', edit: 'pencil', note: 'file-text', piggy: 'piggy-bank',
};

export function icon(name, className = '') {
  const wrapper = document.createElement('span');
  wrapper.className = `ui-icon ${className} ${name === 'arrow-up' ? 'ui-icon--arrow-up' : ''} ${name === 'arrow-down' ? 'ui-icon--arrow-down' : ''}`.trim();
  wrapper.append(createIcon(iconAliases[name] || name));
  return wrapper;
}

export function logo() {
  const wrapper = document.createElement('div');
  wrapper.className = 'brand-lockup';
  wrapper.setAttribute('aria-label', 'Moni');
  wrapper.innerHTML = '<img class="finance-brand-logo" src="./public/assets/brand/moni-organique.png" alt="Moni" />';
  return wrapper;
}

export function iconButton(label, name, action, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button ${className}`.trim();
  button.setAttribute('aria-label', label);
  button.append(icon(name));
  if (action) button.addEventListener('click', action);
  return button;
}

export function createHero(state, { title, subtitle, route, navigate, back = false, backRoute, backLabel }) {
  const hero = document.createElement('section');
  hero.className = `finance-hero finance-hero--${route}`;
  const copy = document.createElement('div');
  copy.className = 'finance-hero__copy';
  const heading = document.createElement('h1');
  heading.textContent = title;
  heading.tabIndex = -1;
  copy.append(heading);
  if (back) {
    const backButton = iconButton(tr(state, backLabel || 'Retour'), 'arrow-left', () => navigate(backRoute || (route === 'goal-edit' ? 'savings' : 'transactions')), 'hero-back');
    hero.append(backButton);
  }
  hero.append(copy);
  return { hero, heading };
}

export function createBottomNav(state, route, navigate) {
  const nav = document.createElement('nav');
  nav.className = 'finance-nav';
  nav.setAttribute('aria-label', tr(state, 'Navigation principale'));
  const items = [['dashboard', 'Accueil', 'house'], ['transactions', 'Transactions', 'arrow-left-right'], ['budgets', 'Budgets', 'chart-pie'], ['savings', 'Épargne', 'piggy-bank'], ['profile', 'Profil', 'user-round']];
  items.forEach(([key, label, iconName]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'finance-nav__item';
    if (route === key || (key === 'profile' && ['settings', 'privacy', 'subscriptions-manage'].includes(route)) || (key === 'transactions' && route === 'transaction-edit') || (key === 'savings' && route === 'goal-edit')) button.setAttribute('aria-current', 'page');
    button.append(icon(iconName), document.createElement('span'));
    button.lastChild.textContent = tr(state, label);
    button.addEventListener('click', () => navigate(key));
    nav.append(button);
  });
  return nav;
}

export function card(className = '') {
  const element = document.createElement('section');
  element.className = `visual-card ${className}`.trim();
  return element;
}

export function createBudgetRing({ progress, label, description }) {
  const ring = document.createElement('div');
  ring.className = 'budget-ring';
  ring.style.setProperty('--progress', `${progress}%`);
  if (description) {
    ring.setAttribute('role', 'img');
    ring.setAttribute('aria-label', description);
  }
  const value = document.createElement('strong');
  value.textContent = `${progress} %`;
  ring.append(value, document.createElement('span'));
  ring.lastChild.textContent = label;
  return ring;
}

export function actionButton(label, action, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `visual-button ${className}`.trim();
  button.textContent = label;
  if (action) button.addEventListener('click', action);
  return button;
}

export function iconActionButton(label, iconName, action, className = '') {
  const button = actionButton(label, action, className);
  button.prepend(icon(iconName));
  return button;
}
