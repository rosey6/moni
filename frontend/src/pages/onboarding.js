import { createDonut } from '../components/donut.js';
import { calculateBudget, getDonutSegments, parseAmount } from '../domain/budget.js';
import { currencyDigits, formatAmount, formatMoney, inputAmount } from '../domain/money.js';
import { getStepIndex, onboardingState, onboardingSteps } from '../app/onboardingState.js';

const currencyOptions = [
  { code: 'XOF', name: 'Franc CFA BCEAO', flag: 'xof' },
  { code: 'MAD', name: 'Dirham marocain', flag: 'mad' },
  { code: 'EUR', name: 'Euro', flag: 'eur' },
  { code: 'USD', name: 'Dollar américain', flag: 'usd' },
];

const currencyNames = new Intl.DisplayNames(['fr'], { type: 'currency' });
const otherCurrencies = Intl.supportedValuesOf('currency')
  .filter((code) => !currencyOptions.some((item) => item.code === code))
  .map((code) => ({ code, name: currencyNames.of(code), flag: '' }));

const stepConfig = {
  budget: { title: 'Quel est ton budget ce mois-ci ?', subtitle: 'Indique le montant que tu souhaites gérer pour ce mois.', asset: 'monthly_calendar' },
  rent: { title: 'Combien dépenses-tu pour ton loyer ?', subtitle: 'Indique le montant que tu consacres à ton logement chaque mois.', asset: 'rent_keys', category: 'rent' },
  transport: { title: 'Combien dépenses-tu en transport ?', subtitle: '', asset: 'transport_bus', category: 'transport' },
  groceries: { title: 'Combien dépenses-tu en courses ?', subtitle: '', asset: 'groceries_bag', category: 'groceries' },
  unexpected: { title: 'Combien prévois-tu pour les imprévus ?', subtitle: '', asset: 'unexpected_bulb', category: 'unexpected' },
};

export function createOnboardingPage(app, step, navigate) {
  app.className = 'onboarding-page';
  app.removeAttribute('aria-labelledby');
  app.replaceChildren();
  const index = getStepIndex(step);
  const back = createBackButton(index, navigate);
  const content = document.createElement('div');
  content.className = 'onboarding-content';
  content.append(createBrand(), createProgress(index), createHeading(step));
  if (step === 'currency') content.append(createCurrencyHero(), createCurrencyPanel(navigate));
  else content.append(createMascot(step), createFinancePanel(step, navigate));
  app.append(back, content);
  document.title = 'Moni — ' + content.querySelector('h1').textContent;
  content.querySelector('h1').tabIndex = -1;
  content.querySelector('h1').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function createBackButton(index, navigate) {
  const button = document.createElement('button');
  button.className = 'onboarding-back';
  button.type = 'button';
  button.setAttribute('aria-label', 'Revenir à l’étape précédente');
  button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 32 32"><path d="M26 16H6M14 8l-8 8 8 8"/></svg>';
  button.addEventListener('click', () => {
    if (index <= 0) {
      navigate('signup');
    } else navigate(onboardingSteps[index - 1]);
  });
  return button;
}

function createBrand() {
  const brand = document.createElement('div');
  brand.className = 'brand onboarding-brand';
  brand.setAttribute('aria-label', 'Moni');
  brand.innerHTML = '<span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span class="brand-name">Moni</span><span class="brand-spark" aria-hidden="true"><i></i><i></i></span>';
  return brand;
}

function createProgress(index) {
  const progress = document.createElement('p');
  progress.className = 'onboarding-progress';
  progress.textContent = 'Étape ' + (index + 1) + ' sur 6';
  return progress;
}

function createHeading(step) {
  const heading = document.createElement('header');
  heading.className = 'onboarding-heading';
  const title = document.createElement('h1');
  title.textContent = step === 'currency' ? 'Choisis ta devise' : stepConfig[step].title;
  heading.append(title);
  const subtitle = document.createElement('p');
  subtitle.textContent = step === 'currency' ? 'Sélectionne la monnaie de ton budget.' : stepConfig[step].subtitle;
  if (subtitle.textContent) heading.append(subtitle);
  return heading;
}

function createMascot(step) {
  const hero = document.createElement('div');
  hero.className = 'onboarding-mascot';
  const image = document.createElement('img');
  image.src = './public/assets/mascots/' + stepConfig[step].asset + '.png';
  image.alt = 'Mascotte Moni pour ' + stepConfig[step].title.toLowerCase();
  hero.append(image);
  return hero;
}

function createCurrencyHero() {
  const hero = document.createElement('div');
  hero.className = 'onboarding-mascot onboarding-mascot--currency';
  const image = document.createElement('img');
  image.src = './public/assets/mascots/currency_point_down.png';
  image.alt = 'Mascotte Moni pointant vers le choix de devise';
  hero.append(image);
  return hero;
}

function createCurrencyPanel(navigate) {
  const panel = document.createElement('section');
  panel.className = 'onboarding-panel currency-panel';
  const search = document.createElement('input');
  search.className = 'currency-search';
  search.type = 'search';
  search.placeholder = 'Rechercher une devise';
  search.setAttribute('aria-label', 'Rechercher une devise');
  const cards = document.createElement('div');
  cards.className = 'currency-grid';
  const notice = document.createElement('p');
  notice.className = 'onboarding-notice';
  notice.textContent = 'Démonstration · Montants conservés jusqu’au rechargement. XOF : devise partagée, représentée ici par la Côte d’Ivoire.';
  const changePanel = document.createElement('div');
  changePanel.hidden = true;
  const warning = document.createElement('p');
  warning.textContent = 'Changer de devise effacera les montants saisis. Aucune conversion ne sera effectuée.';
  const confirm = createSecondaryButton('Changer et effacer les montants', () => {});
  const cancel = createSecondaryButton('Conserver ma devise', () => { changePanel.hidden = true; });
  changePanel.append(warning, confirm, cancel);
  const renderCards = () => {
    cards.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const selected = otherCurrencies.find((item) => item.code === onboardingState.currency);
    const options = query ? [...currencyOptions, ...otherCurrencies] : [...currencyOptions, ...(selected ? [selected] : [])];
    options.filter((item) => (item.code + ' ' + item.name).toLowerCase().includes(query)).forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'currency-card' + (item.code === onboardingState.currency ? ' is-selected' : '');
      card.setAttribute('aria-pressed', String(item.code === onboardingState.currency));
      if (item.flag) {
        const flag = document.createElement('img');
        flag.className = 'currency-flag';
        flag.src = './public/assets/flags/' + item.flag + '.svg';
        flag.alt = '';
        card.append(flag);
      }
      const label = document.createElement('span');
      const code = document.createElement('strong');
      code.textContent = item.code;
      const name = document.createElement('small');
      name.textContent = item.name;
      label.append(code, name);
      card.append(label);
      card.addEventListener('click', () => {
        const select = () => {
          onboardingState.currency = item.code;
          changePanel.hidden = true;
          renderCards();
          [...cards.querySelectorAll('button')].find((button) => button.getAttribute('aria-pressed') === 'true')?.focus();
        };
        if (item.code !== onboardingState.currency && (onboardingState.budget || onboardingState.subscriptions.length || Object.values(onboardingState.allocations).some(Boolean))) {
          changePanel.hidden = false;
          confirm.onclick = () => {
            onboardingState.budget = 0;
            onboardingState.subscriptions = [];
            Object.keys(onboardingState.allocations).forEach((key) => { onboardingState.allocations[key] = 0; });
            select();
          };
          confirm.focus();
        } else select();
      });
      cards.append(card);
    });
    if (!cards.children.length) cards.textContent = 'Aucune devise trouvée.';
  };
  search.addEventListener('input', renderCards);
  renderCards();
  const continueButton = createPrimaryButton('Continuer', () => navigate('budget'));
  panel.append(search, cards, changePanel, continueButton, notice);
  return panel;
}

function createFinancePanel(step, navigate) {
  const config = stepConfig[step];
  const panel = document.createElement('section');
  panel.className = 'onboarding-panel finance-panel';
  const form = document.createElement('form');
  form.noValidate = true;
  const inputLabel = document.createElement('label');
  inputLabel.className = 'amount-label';
  inputLabel.textContent = step === 'budget' ? 'Mon budget mensuel' : 'Montant prévu';
  const inputRow = document.createElement('div');
  inputRow.className = 'amount-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = currencyDigits(onboardingState.currency) ? 'decimal' : 'numeric';
  input.placeholder = '0';
  input.value = inputAmount(step === 'budget' ? onboardingState.budget : onboardingState.allocations[config.category], onboardingState.currency);
  input.id = 'onboarding-amount';
  inputLabel.htmlFor = input.id;
  input.setAttribute('aria-label', inputLabel.textContent);
  const currency = document.createElement('span');
  currency.className = 'amount-currency';
  currency.textContent = onboardingState.currency;
  inputRow.append(input, currency);
  const error = document.createElement('p');
  error.className = 'onboarding-error';
  error.id = 'amount-error';
  input.setAttribute('aria-describedby', error.id);
  error.setAttribute('aria-live', 'polite');
  if (calculateBudget(onboardingState.budget, onboardingState.allocations).exceedsBudget) error.textContent = 'La somme des allocations dépasse ton budget mensuel.';
  const visualization = document.createElement('div');
  visualization.className = 'onboarding-visualization';
  const actions = document.createElement('div');
  actions.className = 'onboarding-actions';
  const continueButton = createPrimaryButton('Continuer', () => submit());
  actions.append(continueButton);
  if (step !== 'budget') actions.append(createSecondaryButton('Passer cette étape', () => {
    onboardingState.allocations[config.category] = 0;
    if (step === 'unexpected') { input.value = '0'; submit(); }
    else navigate(nextStep(step));
  }));
  form.addEventListener('submit', (event) => { event.preventDefault(); submit(); });
  input.addEventListener('input', () => {
    const value = input.value === '' ? 0 : parseAmount(input.value, currencyDigits(onboardingState.currency));
    error.textContent = value === null ? 'Saisis un montant positif avec au plus ' + currencyDigits(onboardingState.currency) + ' décimales.' : '';
    input.setAttribute('aria-invalid', String(value === null));
    if (value !== null) {
      if (step === 'budget') onboardingState.budget = value;
      else onboardingState.allocations[config.category] = value;
    }
    updateVisualization(visualization, step);
    if (value !== null && calculateBudget(onboardingState.budget, onboardingState.allocations).exceedsBudget) error.textContent = 'La somme des allocations dépasse ton budget mensuel.';
  });
  function submit() {
    const value = input.value === '' ? 0 : parseAmount(input.value, currencyDigits(onboardingState.currency));
    if (value === null) {
      error.textContent = 'Saisis un montant positif valide pour cette devise.';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    if (step === 'budget') onboardingState.budget = value;
    else onboardingState.allocations[config.category] = value;
    if (step === 'unexpected' && calculateBudget(onboardingState.budget, onboardingState.allocations).exceedsBudget) {
      error.textContent = 'La somme des allocations dépasse ton budget mensuel.';
      updateVisualization(visualization, step);
      input.focus();
      return;
    }
    if (step === 'unexpected') {
      navigate('subscriptions');
      return;
    }
    navigate(nextStep(step));
  }
  form.append(inputLabel, inputRow, error, visualization, actions);
  updateVisualization(visualization, step);
  panel.append(form);
  return panel;
}

function updateVisualization(container, step) {
  const summary = calculateBudget(onboardingState.budget, onboardingState.allocations);
  const amount = step === 'budget' ? onboardingState.budget : onboardingState.allocations[stepConfig[step].category];
  const centerLabel = step === 'budget' ? '' : summary.exceedsBudget ? 'Dépassement' : 'Non réparti';
  container.replaceChildren(createDonut({
    previous: container,
    segments: step === 'budget' ? getDonutSegments(onboardingState.budget, {}) : getDonutSegments(onboardingState.budget, onboardingState.allocations),
    centerLabel,
    centerValue: formatAmount(step === 'budget' ? amount : Math.abs(summary.remaining), onboardingState.currency),
    currency: onboardingState.currency,
    description: 'Budget prévu : ' + formatMoney(onboardingState.budget, onboardingState.currency) + '. ' + Object.entries(onboardingState.allocations).map(([key, value]) => ({rent:'Loyer',transport:'Transport',groceries:'Courses',unexpected:'Imprévus'}[key]) + ' : ' + formatMoney(value, onboardingState.currency)).join('. ') + '. Non réparti : ' + formatMoney(Math.max(0, summary.remaining), onboardingState.currency) + (summary.exceedsBudget ? '. Dépassement : ' + formatMoney(-summary.remaining, onboardingState.currency) : ''),
  }));
  if (step !== 'budget' && summary.remaining >= 0 && onboardingState.budget > 0) {
    const remaining = document.createElement('p');
    remaining.className = 'remaining-budget';
    remaining.textContent = 'Budget restant : ' + formatMoney(summary.remaining, onboardingState.currency);
    container.append(remaining);
  }
}

function nextStep(step) {
  return onboardingSteps[Math.min(getStepIndex(step) + 1, onboardingSteps.length - 1)];
}

function createPrimaryButton(label, onClick) {
  const button = document.createElement('button');
  button.className = 'onboarding-primary';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function createSecondaryButton(label, onClick) {
  const button = document.createElement('button');
  button.className = 'onboarding-secondary';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}
