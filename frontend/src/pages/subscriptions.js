import { onboardingState } from '../app/onboardingState.js';
import { parseAmount } from '../domain/budget.js';
import { currencyDigits, formatMoney, inputAmount } from '../domain/money.js';
import { saveSubscription, removeSubscription, calculatePlannedTotal, monthlyDueDay } from '../domain/subscriptions.js';

const services = ['Spotify', 'ChatGPT', 'YouTube Premium', 'Netflix', 'Canva'];
const categories = { rent: 'Loyer', transport: 'Transport', groceries: 'Courses', unexpected: 'Imprévus' };
let editing = null;
let viewDate = new Date();
let loadingTimer;

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
  const back = button('←', () => navigate(route === 'subscriptions' ? 'unexpected' : 'subscriptions'), 'onboarding-back');
  back.setAttribute('aria-label', 'Revenir à l’étape précédente');
  const content = document.createElement('div');
  content.className = 'onboarding-content subscriptions-content';
  const brand = document.createElement('div');
  brand.className = 'brand onboarding-brand';
  brand.setAttribute('aria-label', 'Moni');
  brand.innerHTML = '<span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span class="brand-name">Moni</span><span class="brand-spark" aria-hidden="true"><i></i><i></i></span>';
  const heading = document.createElement('h1');
  heading.tabIndex = -1;
  heading.textContent = route === 'subscriptions' ? 'Quels sont tes abonnements ?' : route === 'subscription-edit' ? 'Quand paies-tu ton abonnement ?' : 'On prépare ton espace…';
  const hero = document.createElement('img');
  hero.className = 'subscriptions-mascot';
  hero.alt = '';
  hero.src = './public/assets/mascots/' + (route === 'loading' ? 'loading_thinking.png' : 'subscriptions_phone.png');
  content.append(brand, heading, hero);
  if (route === 'subscriptions') content.append(createList(navigate));
  if (route === 'subscription-edit') content.append(createEditor(navigate));
  if (route === 'loading') {
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = 'Préparation de la démonstration…';
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    content.append(spinner, status);
    loadingTimer = setTimeout(() => {
      if (!app.contains(status)) return;
      spinner.hidden = true;
      status.textContent = 'Onboarding terminé en démonstration. Le tableau de bord sera disponible dans une prochaine étape.';
      content.append(button('Modifier mes abonnements', () => navigate('subscriptions')));
    }, 900);
  }
  app.append(back, content);
  heading.focus({ preventScroll: true });
  window.scrollTo(0, 0);
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
    const edit = button((selected ? 'Modifier ' : 'Configurer ') + name, () => { editing = name; navigate('subscription-edit'); }, 'subscription-edit');
    const icon = document.createElement('span');
    icon.className = 'service-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = name[0].toUpperCase();
    edit.prepend(icon);
    card.append(edit);
    if (selected) {
      const remove = button('×', () => { onboardingState.subscriptions = removeSubscription(onboardingState.subscriptions, name); navigate('subscriptions'); }, 'subscription-remove');
      remove.setAttribute('aria-label', 'Retirer ' + name);
      card.append(remove);
    }
    grid.append(card);
  });
  grid.append(button('+ Autre abonnement', () => { editing = null; navigate('subscription-edit'); }, 'subscription-card subscription-other'));
  const info = document.createElement('p');
  const total = calculatePlannedTotal(onboardingState.allocations, onboardingState.subscriptions);
  info.setAttribute('role', 'status');
  info.textContent = 'Total prévu : ' + formatMoney(total, onboardingState.currency) + (total > onboardingState.budget ? ' — attention, le budget disponible est dépassé.' : '') + ' Les abonnements liés sont compris dans leur allocation.';
  panel.append(grid, info, button('Continuer', () => navigate('loading'), 'onboarding-primary'), button('Passer cette étape', () => navigate('loading')));
  return panel;
}

function createEditor(navigate) {
  const current = onboardingState.subscriptions.find((item) => item.name === editing);
  const panel = document.createElement('form');
  panel.className = 'onboarding-panel subscription-form';
  panel.noValidate = true;
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Nom du service';
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
  amountLabel.textContent = 'Montant mensuel (' + onboardingState.currency + ')';
  const amount = document.createElement('input');
  amount.inputMode = 'decimal';
  amount.value = current ? inputAmount(current.amount, onboardingState.currency) : '';
  amountLabel.append(amount);
  amountLabel.hidden = !day;
  const allocationLabel = document.createElement('label');
  allocationLabel.textContent = 'Compris dans une allocation existante ?';
  const allocation = document.createElement('select');
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Non, charge distincte';
  allocation.append(none);
  Object.entries(categories).forEach(([key, label]) => { const option = document.createElement('option'); option.value = key; option.textContent = label; allocation.append(option); });
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
    previous.setAttribute('aria-label', 'Mois précédent');
    const next = button('›', () => { viewDate = new Date(year, month + 1, 1); drawCalendar(); }, 'calendar-arrow');
    next.setAttribute('aria-label', 'Mois suivant');
    const title = document.createElement('strong');
    title.textContent = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(viewDate);
    navigation.append(previous, title, next);
    const days = document.createElement('div');
    days.className = 'calendar-grid';
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((letter) => { const span = document.createElement('span'); span.textContent = letter; days.append(span); });
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let index = 0; index < offset; index++) days.append(document.createElement('span'));
    for (let value = 1; value <= monthlyDueDay(year, month + 1, 31); value++) {
      const cell = button(String(value), () => { day = value; amountLabel.hidden = false; drawCalendar(); }, 'calendar-day');
      cell.setAttribute('aria-label', value + ' ' + title.textContent);
      cell.setAttribute('aria-pressed', String(value === day));
      days.append(cell);
    }
    chosen.textContent = day ? 'Jour mensuel choisi : ' + day + '. Si le mois est plus court, paiement le dernier jour du mois.' : 'Choisis un jour de paiement.';
    calendar.append(navigation, days);
  };
  drawCalendar();
  const submit = document.createElement('button');
  submit.className = 'onboarding-primary';
  submit.type = 'submit';
  submit.textContent = 'Enregistrer';
  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const parsed = parseAmount(amount.value, currencyDigits(onboardingState.currency));
      if (parsed === null) throw new Error('Saisis un montant valide.');
      const updated = saveSubscription(onboardingState.subscriptions, { name: name.value, amount: parsed, billingDay: day, includedIn: allocation.value }, current?.name || null);
      calculatePlannedTotal(onboardingState.allocations, updated);
      onboardingState.subscriptions = updated;
      navigate('subscriptions');
    } catch (exception) { error.textContent = exception.message; }
  });
  panel.append(nameLabel, calendar, chosen, amountLabel, allocationLabel, error, submit, button('Retour', () => navigate('subscriptions')));
  return panel;
}
