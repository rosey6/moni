import { earlyText as tr, earlyLocale } from '../app/i18nEarly.js';
import { onboardingState, serializeOnboarding } from '../app/onboardingState.js';
import { parseAmount } from '../domain/budget.js';
import { currencyDigits, formatMoney, inputAmount } from '../domain/money.js';
import { saveSubscription, removeSubscription, calculatePlannedTotal, monthlyDueDay } from '../domain/subscriptions.js';
import { createIcon } from '../components/icon.js';
import { saveOnboarding } from '../app/api.js';
import { applyServerState } from '../app/serverState.js';
import { createFontAwesomeIcon } from '../components/fontAwesome.js';

const services = ['Spotify', 'OpenAI', 'YouTube', 'Netflix', 'Canva', 'Orange', 'inwi', 'Maroc Telecom'];
const categories = { rent: 'Loyer', transport: 'Transport', groceries: 'Courses', unexpected: 'Imprévus' };
let editing = null;
let viewDate = new Date();
let loadingTimer;

function serviceIcon(name) {
  const icon = document.createElement('span');
  icon.className = 'service-icon';
  icon.setAttribute('aria-hidden', 'true');
  const brands = { Spotify: 'faSpotify', OpenAI: 'faOpenai', YouTube: 'faYoutube' };
  if (brands[name]) icon.append(createFontAwesomeIcon(brands[name]));
  else {
    const logo = document.createElement('img');
    logo.className = 'service-logo';
    logo.src = `./public/assets/brands/${name.toLowerCase().replaceAll(' ', '-')}.svg`;
    logo.alt = '';
    logo.loading = 'lazy';
    logo.decoding = 'async';
    logo.addEventListener('error', () => { logo.remove(); icon.dataset.fallback = name.slice(0, 1).toUpperCase(); }, { once: true });
    icon.append(logo);
  }
  return icon;
}

function button(label, action, className = 'onboarding-secondary') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

export function createSubscriptionsPage(app, route, navigate) {
  clearTimeout(loadingTimer);
  app.className = 'onboarding-page';
  app.removeAttribute('aria-labelledby');
  app.replaceChildren();
  const back = button('', () => navigate(route === 'subscriptions' ? 'unexpected' : 'subscriptions'), 'onboarding-back');
  back.append(createIcon('arrow-left'));
  back.setAttribute('aria-label', tr("Revenir à l’étape précédente"));
  const content = document.createElement('div');
  content.className = 'onboarding-content subscriptions-content';
  const brand = document.createElement('div');
  brand.className = 'brand onboarding-brand';
  brand.setAttribute('aria-label', 'Moni');
  brand.innerHTML = '<img class="brand-logo" src="./public/assets/brand/moni-organique.png" alt="Moni" />';
  const heading = document.createElement('h1');
  heading.tabIndex = -1;
  heading.textContent = route === 'subscriptions' ? tr("Quels sont tes abonnements ?") : route === 'subscription-edit' ? tr("Quand paies-tu ton abonnement ?") : tr("Ton budget prend forme");
  content.append(brand, heading);
  if (route !== 'loading') {
    const hero = document.createElement('img');
    hero.className = 'subscriptions-mascot';
    hero.alt = '';
    hero.src = './public/assets/mascots/validated/10-abonnements.webp';
    hero.decoding = 'async';
    content.append(hero);
  }
  if (route === 'subscriptions') content.append(createList(navigate));
  if (route === 'subscription-edit') content.append(createEditor(navigate));
  if (route === 'loading') {
    content.classList.add('is-loading');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = tr("Nous préparons ton espace personnel.");
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const dots = document.createElement('div');
    dots.className = 'loading-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    content.insertBefore(spinner, heading);
    content.append(status, dots);
    const retry = button(tr('Réessayer'), () => syncOnboarding(status, retry, navigate), 'onboarding-primary');
    retry.hidden = true;
    content.append(retry);
    loadingTimer = setTimeout(() => syncOnboarding(status, retry, navigate), 0);
  }
  app.append(back, content);
  heading.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function syncOnboarding(status, retry, navigate) {
  retry.hidden = true;
  status.textContent = tr('Nous préparons ton espace personnel.');
  try {
    const result = await saveOnboarding(serializeOnboarding());
    applyServerState(onboardingState, result.state);
    navigate('dashboard');
  } catch (exception) {
    status.textContent = tr(exception.message || 'Impossible d’enregistrer tes données.');
    retry.hidden = false;
  }
}

function createList(navigate) {
  const panel = document.createElement('section');
  panel.className = 'onboarding-panel';
  const grid = document.createElement('div');
  grid.className = 'subscription-grid';
  const names = [...services, ...onboardingState.subscriptions.map((item) => item.name).filter((name) => !services.includes(name))];
  names.forEach((name) => {
    const selected = onboardingState.subscriptions.find((item) => item.name === name);
    const card = document.createElement('div');
    card.className = 'subscription-card' + (selected ? ' selected' : '');
    const edit = button(name, () => { editing = name; navigate('subscription-edit'); }, 'subscription-edit');
    edit.setAttribute('aria-label', `${selected ? tr('Modifier') : tr('Configurer')} ${name}`);
    edit.prepend(serviceIcon(name));
    card.append(edit);
    if (selected) {
      const remove = button('', () => { onboardingState.subscriptions = removeSubscription(onboardingState.subscriptions, name); navigate('subscriptions'); }, 'subscription-remove');
      remove.append(createIcon('x'));
      remove.setAttribute('aria-label', tr("Retirer ") + name);
      card.append(remove);
    }
    grid.append(card);
  });
  const info = document.createElement('p');
  const total = calculatePlannedTotal(onboardingState.allocations, onboardingState.subscriptions);
  info.setAttribute('role', 'status');
  info.textContent = tr("Total prévu : ") + formatMoney(total, onboardingState.currency) + (total > onboardingState.budget ? tr(" — attention, le budget disponible est dépassé.") : '') + tr(" Les abonnements liés sont compris dans leur allocation.");
  panel.append(grid, button(tr('+ Autre abonnement'), () => { editing = null; navigate('subscription-edit'); }, 'subscription-other'), info, button(tr("Continuer"), () => navigate('loading'), 'onboarding-primary'), button(tr("Passer cette étape"), () => navigate('loading')));
  return panel;
}

function createEditor(navigate) {
  const current = onboardingState.subscriptions.find((item) => item.name === editing);
  const panel = document.createElement('form');
  panel.className = 'onboarding-panel subscription-form';
  panel.noValidate = true;
  const nameLabel = document.createElement('label');
  nameLabel.textContent = tr("Nom du service");
  const name = document.createElement('input');
  name.value = editing || '';
  name.maxLength = 80;
  name.required = true;
  nameLabel.append(name);
  const calendar = document.createElement('div');
  const chosen = document.createElement('p');
  chosen.setAttribute('aria-live', 'polite');
  let day = current?.billingDay || null;
  const amountLabel = document.createElement('label');
  amountLabel.textContent = tr("Montant mensuel (") + onboardingState.currency + ')';
  const amount = document.createElement('input');
  amount.inputMode = 'decimal';
  amount.value = current ? inputAmount(current.amount, onboardingState.currency) : '';
  amountLabel.append(amount);
  const allocationLabel = document.createElement('label');
  allocationLabel.textContent = tr("Compris dans une allocation existante ?");
  const allocation = document.createElement('select');
  const none = document.createElement('option');
  none.value = '';
  none.textContent = tr("Non, charge distincte");
  allocation.append(none);
  Object.entries(categories).filter(([key]) => Object.hasOwn(onboardingState.allocations, key)).forEach(([key, label]) => { const option = document.createElement('option'); option.value = key; option.textContent = tr(label); allocation.append(option); });
  allocation.value = current?.includedIn || '';
  allocationLabel.append(allocation);
  const error = document.createElement('p');
  error.setAttribute('role', 'alert');
  const drawCalendar = () => {
    calendar.replaceChildren();
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const navigation = document.createElement('div');
    navigation.className = 'calendar-nav';
    const previous = button('‹', () => { viewDate = new Date(year, month - 1, 1); drawCalendar(); }, 'calendar-arrow');
    previous.setAttribute('aria-label', tr("Mois précédent"));
    const next = button('›', () => { viewDate = new Date(year, month + 1, 1); drawCalendar(); }, 'calendar-arrow');
    next.setAttribute('aria-label', tr("Mois suivant"));
    const title = document.createElement('strong');
    title.textContent = new Intl.DateTimeFormat(earlyLocale(), { month: 'long', year: 'numeric' }).format(viewDate);
    navigation.append(previous, title, next);
    const days = document.createElement('div');
    days.className = 'calendar-grid';
    (earlyLocale() === 'en-US' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D']).forEach((letter) => { const span = document.createElement('span'); span.textContent = letter; days.append(span); });
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let index = 0; index < offset; index++) days.append(document.createElement('span'));
    for (let value = 1; value <= monthlyDueDay(year, month + 1, 31); value++) {
      const cell = button(String(value), () => { day = value; drawCalendar(); }, 'calendar-day');
      cell.setAttribute('aria-label', value + ' ' + title.textContent);
      cell.setAttribute('aria-pressed', String(value === day));
      days.append(cell);
    }
    chosen.textContent = day ? tr("Jour mensuel choisi : ") + day + tr(". Si le mois est plus court, paiement le dernier jour du mois.") : tr("Choisis un jour de paiement.");
    calendar.append(navigation, days);
  };
  drawCalendar();
  const submit = document.createElement('button');
  submit.className = 'onboarding-primary';
  submit.type = 'submit';
  submit.textContent = tr("Enregistrer");
  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const parsed = parseAmount(amount.value, currencyDigits(onboardingState.currency));
      if (parsed === null) throw new Error(tr("Saisis un montant valide."));
      const updated = saveSubscription(onboardingState.subscriptions, { name: name.value, amount: parsed, billingDay: day, includedIn: allocation.value }, current?.name || null);
      calculatePlannedTotal(onboardingState.allocations, updated);
      onboardingState.subscriptions = updated;
      navigate('subscriptions');
    } catch (exception) { error.textContent = tr(exception.message); }
  });
  panel.append(nameLabel, amountLabel, calendar, chosen, allocationLabel, error, submit, button(tr("Retour"), () => navigate('subscriptions')));
  return panel;
}
