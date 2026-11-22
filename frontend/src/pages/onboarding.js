import { earlyText as tr, earlyLocale } from '../app/i18nEarly.js?v=full-i18n-20261122';
import { switchCurrency } from '../app/financeState.js';
import { calculatePlannedTotal } from '../domain/subscriptions.js';
import { createDonut } from '../components/donut.js';
import { calculateBudget, getDonutSegments, parseAmount } from '../domain/budget.js';
import { currencyDigits, formatAmount, formatMoney, inputAmount } from '../domain/money.js';
import { getStepIndex, onboardingState, onboardingSteps } from '../app/onboardingState.js';
import { createIcon } from '../components/icon.js';

const currencyOptions = [
  { code: 'XOF', name: 'Franc CFA BCEAO · UEMOA', symbol: 'F CFA', region: 'UEMOA' },
  { code: 'MAD', name: 'Dirham marocain', symbol: 'د.م.', flag: 'mad.svg' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: 'eur.svg' },
  { code: 'USD', name: 'Dollar américain', symbol: '$', flag: 'usd.svg' },
  { code: 'GBP', name: 'Livre sterling', symbol: '£', flag: 'gb.svg' },
  { code: 'CAD', name: 'Dollar canadien', symbol: '$', flag: 'ca.svg' },
  { code: 'CHF', name: 'Franc suisse', symbol: 'CHF', flag: 'ch.svg' },
  { code: 'JPY', name: 'Yen japonais', symbol: '¥', flag: 'jp.svg' },
  { code: 'CNY', name: 'Yuan chinois', symbol: '¥', flag: 'cn.svg' },
  { code: 'AED', name: 'Dirham des Émirats arabes unis', symbol: 'د.إ', flag: 'ae.svg' },
  { code: 'AUD', name: 'Dollar australien', symbol: '$', flag: 'au.svg' },
  { code: 'BRL', name: 'Réal brésilien', symbol: 'R$', flag: 'br.svg' },
  { code: 'INR', name: 'Roupie indienne', symbol: '₹', flag: 'in.svg' },
  { code: 'NGN', name: 'Naira nigérian', symbol: '₦', flag: 'ng.svg' },
  { code: 'ZAR', name: 'Rand sud-africain', symbol: 'R', flag: 'za.svg' },
  { code: 'TRY', name: 'Livre turque', symbol: '₺', flag: 'tr.svg' },
];



const stepConfig = {
  budget: { title: 'Budget du mois', category: 'budget' },
  rent: { title: 'Loyer', category: 'rent' },
  transport: { title: 'Transport', category: 'transport' },
  groceries: { title: 'Courses', category: 'groceries' },
  unexpected: { title: 'Imprévus', category: 'unexpected' },
};
const amountSuggestions = {
  budget: [100000, 250000, 500000, 1000000],
  rent: [50000, 100000, 120000, 150000],
  transport: [10000, 20000, 30000, 50000],
  groceries: [25000, 45000, 60000, 80000],
  unexpected: [5000, 10000, 15000, 25000],
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
  if (step === 'currency') content.append(createCurrencyPanel(navigate));
  else content.append(createFinancePanel(step, navigate));
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
  button.setAttribute('aria-label', tr("Revenir à l’étape précédente"));
  button.append(createIcon('arrow-left'));
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
  brand.innerHTML = '<img class="brand-logo" src="./public/assets/brand/moni-organique.png" alt="Moni" />';
  return brand;
}

function createProgress(index) {
  const progress = document.createElement('div');
  progress.className = 'onboarding-progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', tr('Progression de l’onboarding'));
  progress.setAttribute('aria-valuemin', '1');
  progress.setAttribute('aria-valuemax', '7');
  progress.setAttribute('aria-valuenow', String(index + 1));
  const track = document.createElement('span');
  track.className = 'onboarding-progress__track';
  const fill = document.createElement('span');
  fill.className = 'onboarding-progress__fill';
  fill.style.width = `${((index + 1) / 7) * 100}%`;
  track.append(fill);
  const count = document.createElement('span');
  count.className = 'onboarding-progress__count';
  count.textContent = `${index + 1}/7`;
  progress.append(track, count);
  return progress;
}

function createHeading(step) {
  const heading = document.createElement('header');
  heading.className = 'onboarding-heading';
  const title = document.createElement('h1');
  title.textContent = step === 'currency' ? tr("Choisis ta devise") : tr(stepConfig[step].title);
  heading.append(title);
  return heading;
}

function createCurrencyPanel(navigate) {
  const panel = document.createElement('section');
  const currencyNames = new Intl.DisplayNames([earlyLocale()], { type: 'currency' });
  const optionsForLocale = currencyOptions.map(item => ({ ...item, name: item.region ? item.name : currencyNames.of(item.code) }));
  const otherCurrencies = Intl.supportedValuesOf('currency').filter(code => !currencyOptions.some(item => item.code === code)).map(code => ({ code, name: currencyNames.of(code), symbol: code, country: '', flag: '' }));
  panel.className = 'onboarding-panel currency-panel';
  const search = document.createElement('input');
  search.className = 'currency-search';
  search.type = 'search';
  search.placeholder = tr("Rechercher une devise");
  search.setAttribute('aria-label', tr("Rechercher une devise"));
  const cards = document.createElement('div');
  cards.className = 'currency-grid';
  const selectedNote = document.createElement('p');
  selectedNote.className = 'currency-selected-note';
  const changePanel = document.createElement('div');
  changePanel.hidden = true;
  const warning = document.createElement('p');
  warning.textContent = tr("Chaque devise possède son espace distinct. Les montants restent dans leur devise d’origine, sans conversion.");
  const confirm = createSecondaryButton(tr("Changer d’espace de devise"), () => {});
  const cancel = createSecondaryButton(tr("Conserver ma devise"), () => { changePanel.hidden = true; });
  changePanel.append(warning, confirm, cancel);
  const renderCards = () => {
    cards.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const selected = otherCurrencies.find((item) => item.code === onboardingState.currency);
    const defaults = optionsForLocale.slice(0, 4);
    const options = query ? [...optionsForLocale, ...otherCurrencies] : defaults;
    selectedNote.textContent = !query && selected && !defaults.some(item => item.code === selected.code) ? `${tr('Devise sélectionnée')} : ${selected.code}` : '';
    options.filter((item) => (item.code + ' ' + item.name).toLowerCase().includes(query)).forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'currency-card' + (item.code === onboardingState.currency ? ' is-selected' : '');
      card.setAttribute('aria-pressed', String(item.code === onboardingState.currency));
      if (item.flag) {
        const flag = document.createElement('img');
        flag.className = 'currency-flag';
        flag.src = `./public/assets/flags/${item.flag}`;
        flag.alt = '';
        flag.setAttribute('aria-hidden', 'true');
        flag.loading = 'lazy';
        card.append(flag);
      } else {
        const symbol = document.createElement('span');
        symbol.className = 'currency-symbol currency-symbol--code';
        symbol.textContent = item.region || item.symbol || item.code;
        symbol.setAttribute('aria-hidden', 'true');
        card.append(symbol);
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
          switchCurrency(onboardingState, item.code);
          changePanel.hidden = true;
          renderCards();
          [...cards.querySelectorAll('button')].find((button) => button.getAttribute('aria-pressed') === 'true')?.focus();
        };
        if (item.code !== onboardingState.currency && (onboardingState.budget || onboardingState.subscriptions.length || Object.values(onboardingState.allocations).some(Boolean))) {
          changePanel.hidden = false;
          confirm.onclick = () => {
            select();
          };
          confirm.focus();
        } else select();
      });
      cards.append(card);
    });
    if (!cards.children.length) cards.textContent = tr("Aucune devise trouvée.");
  };
  search.addEventListener('input', renderCards);
  renderCards();
  const continueButton = createPrimaryButton(tr("Continuer"), () => navigate('budget'));
  panel.append(search, selectedNote, cards, changePanel, continueButton);
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
  inputLabel.textContent = step === 'budget' ? tr("Mon budget mensuel") : tr("Montant prévu");
  const inputRow = document.createElement('div');
  inputRow.className = 'amount-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = currencyDigits(onboardingState.currency) ? 'decimal' : 'numeric';
  input.placeholder = '0';
  input.value = inputAmount(step === 'budget' ? onboardingState.budget : (onboardingState.allocations[config.category] ?? 0), onboardingState.currency);
  let validated = onboardingState.validatedSteps.includes(step);
  let committedValue = step === 'budget' ? onboardingState.budget : (onboardingState.allocations[config.category] ?? 0);
  let acceptingValue = false;
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
  if (calculateBudget(onboardingState.budget, onboardingState.allocations).exceedsBudget) error.textContent = tr("La somme des allocations dépasse ton budget mensuel.");
  const visualization = document.createElement('div');
  visualization.className = 'onboarding-visualization';
  const dialogActions = document.createElement('div');
  dialogActions.className = 'onboarding-actions';
  dialogActions.append(createPrimaryButton(tr('Valider'), () => submit()));
  if (step !== 'budget') dialogActions.append(createSecondaryButton(tr("Passer cette étape"), () => {
    onboardingState.allocations[config.category] = 0;
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    submit();
  }));
  form.addEventListener('submit', (event) => { event.preventDefault(); submit(); });
  input.addEventListener('input', () => {
    const value = input.value === '' ? 0 : parseAmount(input.value, currencyDigits(onboardingState.currency));
    error.textContent = value === null ? tr("Saisis un montant positif avec au plus ") + currencyDigits(onboardingState.currency) + tr(" décimales.") : '';
    input.setAttribute('aria-invalid', String(value === null));
    if (value !== null) {
      try { if (step !== 'budget') calculatePlannedTotal({ ...onboardingState.allocations, [config.category]: value }, onboardingState.subscriptions); }
      catch { error.textContent = tr("Le total prévu est trop élevé."); input.setAttribute('aria-invalid', 'true'); return; }
      if (step === 'budget') onboardingState.budget = value;
      else onboardingState.allocations[config.category] = value;
    }
    updateVisualization(visualization, step);
    if (value !== null && calculateBudget(onboardingState.budget, onboardingState.allocations).exceedsBudget) error.textContent = tr("La somme des allocations dépasse ton budget mensuel.");
  });
  function submit() {
    const value = input.value === '' ? 0 : parseAmount(input.value, currencyDigits(onboardingState.currency));
    if (value === null) {
      error.textContent = tr("Saisis un montant positif valide pour cette devise.");
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    if (step === 'budget' && value === 0) {
      error.textContent = tr('Ton budget mensuel doit être supérieur à zéro.');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    try { if (step !== 'budget') calculatePlannedTotal({ ...onboardingState.allocations, [config.category]: value }, onboardingState.subscriptions); }
    catch { error.textContent = tr("Le total prévu est trop élevé."); input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    if (step === 'budget') onboardingState.budget = value;
    else onboardingState.allocations[config.category] = value;
    if (step === 'unexpected' && calculateBudget(onboardingState.budget, onboardingState.allocations).exceedsBudget) {
      error.textContent = tr("La somme des allocations dépasse ton budget mensuel.");
      updateVisualization(visualization, step);
      input.focus();
      return;
    }
    committedValue = value;
    if (!validated) onboardingState.validatedSteps.push(step);
    validated = true;
    updateVisualization(visualization, step);
    reopen.textContent = tr('Modifier le montant');
    reopen.hidden = false;
    continueButton.hidden = false;
    acceptingValue = true;
    dialog.close();
    continueButton.focus({ preventScroll: true });
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'onboarding-amount-dialog';
  dialog.setAttribute('aria-labelledby', 'onboarding-amount-title');
  const dialogHeader = document.createElement('div');
  dialogHeader.className = 'onboarding-amount-dialog__header';
  const dialogTitle = document.createElement('h2');
  dialogTitle.id = 'onboarding-amount-title';
  dialogTitle.textContent = step === 'budget' ? tr('Budget mensuel') : tr(stepConfig[step].title);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'onboarding-amount-dialog__close';
  close.setAttribute('aria-label', tr('Fermer la saisie'));
  close.textContent = '×';
  close.addEventListener('click', () => dialog.close());
  dialogHeader.append(dialogTitle, close);
  const suggestionHeading = document.createElement('p');
  suggestionHeading.className = 'onboarding-amount-dialog__suggestion-title';
  suggestionHeading.textContent = tr('Montants suggérés');
  const suggestions = document.createElement('div');
  suggestions.className = 'onboarding-amount-suggestions';
  amountSuggestions[step].forEach(value => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'onboarding-amount-suggestion';
    option.textContent = formatAmount(value, onboardingState.currency);
    option.setAttribute('aria-pressed', String(parseAmount(input.value, currencyDigits(onboardingState.currency)) === value));
    option.addEventListener('click', () => {
      input.value = inputAmount(value, onboardingState.currency);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      suggestions.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === option)));
    });
    suggestions.append(option);
  });
  const otherAmount = createSecondaryButton(tr('Autre montant'), () => input.focus());
  otherAmount.classList.add('onboarding-amount-dialog__other');
  input.addEventListener('input', () => suggestions.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(parseAmount(input.value, currencyDigits(onboardingState.currency)) === amountSuggestions[step][[...suggestions.children].indexOf(button)]))));
  dialog.append(dialogHeader, document.createElement('p'), inputLabel, inputRow, error, suggestionHeading, suggestions, otherAmount, dialogActions);
  dialog.children[1].textContent = tr('Saisis ton montant mensuel.');
  const reopen = createSecondaryButton(tr(validated ? 'Modifier le montant' : 'Saisir le montant'), () => { dialog.showModal(); input.focus(); });
  reopen.className = 'onboarding-amount-reopen';
  reopen.hidden = !validated;
  const continueButton = createPrimaryButton(tr('Continuer'), () => navigate(nextStep(step)));
  const validatedActions = document.createElement('div');
  validatedActions.className = 'onboarding-validated-actions';
  continueButton.hidden = !validated;
  validatedActions.append(reopen, continueButton);
  form.append(visualization, validatedActions, dialog);
  dialog.addEventListener('close', () => {
    if (!acceptingValue) {
      input.value = inputAmount(committedValue, onboardingState.currency);
      if (step === 'budget') onboardingState.budget = committedValue;
      else onboardingState.allocations[config.category] = committedValue;
      updateVisualization(visualization, step);
    }
    acceptingValue = false;
  });
  updateVisualization(visualization, step);
  requestAnimationFrame(() => { if (!validated && !dialog.open && dialog.isConnected) { dialog.showModal(); } });
  panel.append(form);
  return panel;
}

function updateVisualization(container, step) {
  const summary = calculateBudget(onboardingState.budget, onboardingState.allocations);
  const amount = step === 'budget' ? onboardingState.budget : (onboardingState.allocations[stepConfig[step].category] ?? 0);
  const centerLabel = summary.exceedsBudget ? tr("Dépassement") : '';
  container.replaceChildren(createDonut({
    previous: container,
    segments: step === 'budget' ? getDonutSegments(onboardingState.budget, {}) : getDonutSegments(onboardingState.budget, onboardingState.allocations),
    centerLabel,
    centerValue: formatAmount(step === 'budget' ? amount : Math.abs(summary.remaining), onboardingState.currency),
    currency: onboardingState.currency,
    description: tr("Budget prévu : ") + formatMoney(onboardingState.budget, onboardingState.currency) + '. ' + Object.entries(onboardingState.allocations).map(([key, value]) => tr(({rent:'Loyer',transport:'Transport',groceries:'Courses',unexpected:'Imprévus'}[key])) + ' : ' + formatMoney(value, onboardingState.currency)).join('. ') + tr(". Non réparti : ") + formatMoney(Math.max(0, summary.remaining), onboardingState.currency) + (summary.exceedsBudget ? tr(". Dépassement : ") + formatMoney(-summary.remaining, onboardingState.currency) : ''),
  }));
  if (step !== 'budget' && summary.remaining >= 0 && onboardingState.budget > 0) {
    const remaining = document.createElement('p');
    remaining.className = 'remaining-budget';
    remaining.textContent = tr("Budget restant : ") + formatMoney(summary.remaining, onboardingState.currency);
    container.append(remaining);
  }
}

function nextStep(step) {
  if (step === 'unexpected') return 'subscriptions';
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
