import { financeText as tr, financeFormat as fmt, financeLocale } from '../app/i18nFinance.js?v=full-i18n-savingsfix-20261122';
import { parseAmount } from '../domain/budget.js';
import { currencyDigits, formatAmount, formatMoney, inputAmount, sumAmounts } from '../domain/money.js';
import { budgetCategories, summarizeBudgets, removeBudget } from '../domain/budgets.js';
import { card, createBudgetRing, createHero, icon, actionButton, iconButton } from '../components/financeUi.js';
import { createDashboardDemoState } from '../app/dashboardDemoFixture.js';
import { saveOnboarding } from '../app/api.js';
import { applyServerState } from '../app/serverState.js';

const categoryIcons = { rent: 'house', transport: 'bus-front', groceries: 'shopping-cart', unexpected: 'triangle-alert' };

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function field(label, input) {
  const wrapper = element('label', undefined, 'visual-field');
  wrapper.append(element('span', label, 'visual-field__label'), element('span', undefined, 'visual-field__control'));
  wrapper.lastChild.append(input);
  return wrapper;
}

function amountSuggestions(reference, currency, multipliers, fallback) {
  const base = Number(reference) > 0 ? Number(reference) : Number(fallback) || 1;
  const step = Math.max(1, 10 ** (Math.floor(Math.log10(base)) - (currencyDigits(currency) ? 2 : 1)));
  return [...new Set(multipliers.map(multiplier => Math.round((base * multiplier) / step) * step))];
}

function renderSuggestions(container, values, input, state, onChange) {
  container.replaceChildren();
  values.forEach(value => {
    const suggestion = actionButton(formatMoney(value, state.currency, state.currency === 'XOF' ? 'code' : 'symbol'), null, 'amount-suggestion');
    suggestion.type = 'button';
    suggestion.dataset.amount = String(value);
    suggestion.setAttribute('aria-pressed', String(Number(input.value) === value));
    suggestion.addEventListener('click', () => { input.value = formatAmount(value, state.currency); onChange(); });
    container.append(suggestion);
  });
}

function previewRow(label, value, tone = '') {
  const row = element('div', undefined, `budget-preview-row ${tone}`.trim());
  row.append(element('span', label), element('strong', value));
  return row;
}

function isVisualDemo() {
  return new URLSearchParams(location.hash.split('?')[1] || '').get('demo') === 'dashboard';
}

async function persistBudgets(state) {
  const result = await saveOnboarding({ currency: state.currency, budget: state.budget, allocations: state.allocations, subscriptions: state.subscriptions });
  applyServerState(state, result.state);
}

export function createBudgetsPage(app, state, navigate) {
  app.replaceChildren();
  const visualDemo = isVisualDemo();
  if (visualDemo) state = createDashboardDemoState(state);
  const { hero, heading } = createHero(state, { title: tr(state, 'Budgets'), route: 'budgets', navigate });
  const month = new Date();
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const summary = summarizeBudgets(state, monthKey);
  const money = amount => formatMoney(amount, state.currency, state.currency === 'XOF' ? 'code' : 'symbol');
  const percent = item => item.limit ? Math.min(100, Math.round((item.spent / item.limit) * 100)) : 0;
  const displayItems = visualDemo ? state.dashboardDemoBudgetRows : summary.items;
  const displayPlanned = summary.planned;
  const displayRemaining = state.budget - displayPlanned;
  const displayProgress = visualDemo ? state.dashboardBudgetProgress : (state.budget ? Math.min(100, Math.round((displayPlanned / state.budget) * 100)) : 0);

  const overview = card('budget-overview');
  const donut = document.createElement('div'); donut.className = 'budget-overview__donut';
  if (state.budget > 0) donut.append(createBudgetRing({ progress: displayProgress, label: tr(state, 'réparti'), description: tr(state, 'Répartition prévue du budget') }));
  else donut.append(element('p', tr(state, 'Aucun budget défini.'), 'empty-copy'));
  overview.append(donut);
  const overviewStats = element('div', undefined, 'budget-overview__stats');
  [['Budget total', money(state.budget), 'wallet-cards'], ['Prévu', money(displayPlanned), 'chart-no-axes-column-increasing'], [displayRemaining < 0 ? 'Dépassement' : 'À répartir', money(Math.abs(displayRemaining)), 'circle-dollar-sign']].forEach(([label, value, iconName], index) => {
    const row = element('div', undefined, `budget-stat ${index === 2 ? (displayRemaining < 0 ? 'is-negative' : 'is-positive') : ''}`);
    row.append(icon(iconName), element('span', label), element('strong', value)); overviewStats.append(row);
  });
  overview.append(overviewStats);

  const headingRow = element('div', undefined, 'section-heading-row');
  let revealEnvelopeEditor = () => {};
  let editingCategory = null;
  const editMonthlyTrigger = iconButton(tr(state, 'Modifier le budget'), 'pencil', () => editBudget.showModal(), 'budget-overview__edit');
  const newBudgetTrigger = iconButton(tr(state, 'Nouveau budget'), 'plus', () => { editingCategory = null; revealEnvelopeEditor(); }, 'budget-add');
  const overviewHeader = element('div', undefined, 'budget-overview__header');
  overviewHeader.append(element('h2', tr(state, 'Budget global')), editMonthlyTrigger);
  overview.append(overviewHeader);
  headingRow.append(element('h2', tr(state, 'Mes budgets')), newBudgetTrigger);

  const list = element('div', undefined, 'budget-list');
  const editBudget = document.createElement('dialog');
  editBudget.className = 'visual-card budget-editor';
  editBudget.setAttribute('aria-labelledby', 'monthly-budget-title');
  const monthlyForm = document.createElement('form');
  monthlyForm.noValidate = true;
  const monthlyHeader = element('div', undefined, 'budget-dialog-header');
  const budgetEditorTitle = element('h2', tr(state, 'Budget mensuel'));
  budgetEditorTitle.id = 'monthly-budget-title';
  const monthlyClose = iconButton(tr(state, 'Fermer'), 'x', () => editBudget.close(), 'dialog-close');
  monthlyHeader.append(icon('calendar-days'), budgetEditorTitle, monthlyClose);
  const currentBudget = element('div', undefined, 'budget-current');
  currentBudget.append(element('span', tr(state, 'Budget actuel')), element('strong', money(state.budget)));
  const monthly = document.createElement('input'); monthly.inputMode = 'decimal'; monthly.value = inputAmount(state.budget, state.currency); monthly.setAttribute('aria-label', fmt(state, 'Nouveau budget ({currency})', { currency: state.currency }));
  const group = new Intl.NumberFormat(financeLocale(state)).formatToParts(1000).find(part => part.type === 'group')?.value || '';
  const readAmount = input => parseAmount(group ? input.value.split(group).join('') : input.value, currencyDigits(state.currency));
  const formatInput = input => { const value = readAmount(input); if (value !== null) input.value = formatAmount(value, state.currency); };
  monthly.addEventListener('blur', () => formatInput(monthly));
  const monthlySuggestionsTitle = element('h3', tr(state, 'Suggestions'));
  const monthlySuggestions = element('div', undefined, 'budget-suggestions');
  const currentMonthlyFallback = ({ XOF: 250000, MAD: 500000, EUR: 100000, USD: 100000 })[state.currency] || 1000;
  const preview = element('div', undefined, 'budget-editor-preview');
  const remainingRow = previewRow(tr(state, 'Restant à répartir après modification'), '');
  const warning = element('p', undefined, 'budget-warning'); warning.setAttribute('role', 'status'); warning.setAttribute('aria-live', 'polite');
  const monthlyError = element('p', undefined, 'form-error'); monthlyError.id = 'monthly-budget-error'; monthlyError.setAttribute('role', 'alert'); monthly.setAttribute('aria-describedby', monthlyError.id);
  const monthlySubmit = actionButton(tr(state, 'Enregistrer'), null, 'wide-primary'); monthlySubmit.type = 'submit';
  const updateMonthlyPreview = () => {
    const value = readAmount(monthly);
    const delta = value === null ? null : value - summary.planned;
    remainingRow.lastChild.textContent = delta === null ? '—' : money(Math.abs(delta));
    remainingRow.lastChild.classList.toggle('is-negative', delta !== null && delta < 0);
    remainingRow.firstChild.textContent = delta !== null && delta < 0 ? tr(state, 'Montant manquant pour couvrir le prévu') : tr(state, 'Restant à répartir après modification');
    warning.hidden = value === null || value >= summary.planned;
    warning.textContent = warning.hidden ? '' : fmt(state, 'Le nouveau budget est inférieur au total des enveloppes et abonnements prévus ({planned}).', { planned: money(summary.planned) });
    monthlySuggestions.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(readAmount(monthly) === Number(button.dataset.amount))));
  };
  renderSuggestions(monthlySuggestions, amountSuggestions(state.budget || summary.planned, state.currency, [0.8, 1, 1.2, 2], currentMonthlyFallback), monthly, state, updateMonthlyPreview);
  monthly.addEventListener('input', updateMonthlyPreview);
  preview.append(previewRow(tr(state, 'Total des enveloppes'), money(summary.allocated)));
  if (summary.planned > summary.allocated) preview.append(previewRow(tr(state, 'Abonnements hors enveloppes'), money(summary.planned - summary.allocated)));
  preview.append(remainingRow);
  const monthlyContent = element('div', undefined, 'budget-dialog-content');
  monthlyContent.append(monthlyHeader, element('p', tr(state, 'Ajuste le montant global sans modifier tes enveloppes ni tes transactions.'), 'dialog-description'), currentBudget, field(fmt(state, 'Nouveau budget ({currency})', { currency: state.currency }), monthly), monthlySuggestionsTitle, monthlySuggestions, preview, warning, monthlyError);
  const monthlyActions = element('div', undefined, 'budget-dialog-actions');
  monthlyActions.append(actionButton(tr(state, 'Annuler'), () => editBudget.close(), 'secondary-wide'), monthlySubmit);
  monthlyForm.append(monthlyContent, monthlyActions);
  formatInput(monthly);
  updateMonthlyPreview();
  editBudget.append(monthlyForm);
  editBudget.addEventListener('close', () => { monthlyError.textContent = ''; });
  monthlyForm.addEventListener('submit', async event => { event.preventDefault(); const value = readAmount(monthly); if (value === null) { monthlyError.textContent = tr(state, 'Saisis un montant valide et positif ou nul.'); monthly.setAttribute('aria-invalid', 'true'); return; } const previous = state.budget; state.budget = value; monthlySubmit.disabled = true; try { if (!visualDemo) await persistBudgets(state); editBudget.close(); navigate('budgets'); } catch (exception) { state.budget = previous; monthlyError.textContent = tr(state, exception.message || 'Impossible d’enregistrer le budget.'); } finally { monthlySubmit.disabled = false; } });

  displayItems.forEach(item => {
    const row = element('article', undefined, 'budget-row');
    const progress = element('div', undefined, 'budget-row__progress'); progress.style.setProperty('--progress', `${percent(item)}%`);
    const progressLine = element('div', undefined, 'budget-row__progress-line');
    progressLine.append(progress, element('strong', `${percent(item)} %`, 'budget-row__percentage'));
    const identity = element('div', undefined, 'budget-row__identity'); identity.append(element('span', undefined, 'category-icon')); identity.firstChild.append(icon(categoryIcons[item.category] || 'target')); identity.append(element('div'));
    identity.lastChild.append(element('strong', tr(state, budgetCategories[item.category] || item.category)));
    const remaining = item.limit - item.spent;
    const amounts = element('div', undefined, 'budget-row__amounts');
    [['Prévu', item.limit], ['Dépensé', item.spent], [remaining < 0 ? 'Dépassé' : 'Restant', Math.abs(remaining)]].forEach(([label, value]) => {
      const stat = element('span', undefined, 'budget-row__stat');
      stat.append(element('small', tr(state, label)), element('strong', money(value)));
      amounts.append(stat);
    });
    amounts.append(progressLine);
    if (remaining < 0) amounts.classList.add('is-negative');
    const disclosure = iconButton(fmt(state, 'Modifier {category}', { category: tr(state, budgetCategories[item.category] || item.category) }), 'pencil', () => { editingCategory = item.category; category.value = item.category; amount.value = inputAmount(item.limit, state.currency); revealEnvelopeEditor(); }, 'row-chevron');
    row.append(identity, amounts, disclosure);
    const actions = element('div', undefined, 'budget-row__actions'); actions.append(actionButton(tr(state, 'Supprimer'), async () => { if (!window.confirm(fmt(state, 'Supprimer l’enveloppe {category} ? Les transactions restent conservées.', { category: tr(state, budgetCategories[item.category] || item.category) }))) return; const previous = { ...state.allocations }; try { removeBudget(state, item.category); await persistBudgets(state); navigate('budgets'); } catch (exception) { state.allocations = previous; error.textContent = tr(state, exception.message || 'Impossible de supprimer le budget.'); error.scrollIntoView({ block: 'nearest' }); } }, 'row-action'));
    if (!visualDemo) row.append(actions);
    list.append(row);
  });

  const subscriptionsCard = element('article', undefined, 'budget-row budget-subscriptions');
  const subscriptionsIdentity = element('div', undefined, 'budget-row__identity');
  subscriptionsIdentity.append(icon('calendar-days', 'category-icon'), element('strong', tr(state, 'Abonnements')));
  const subscriptionsAmounts = element('div', undefined, 'budget-row__amounts');
  const totalSubscriptions = sumAmounts(state.subscriptions.map(item => item.amount));
  const unallocatedSubscriptions = summary.planned - summary.allocated;
  [[tr(state, 'Total prévu'), totalSubscriptions], [tr(state, 'Inclus dans les enveloppes'), totalSubscriptions - unallocatedSubscriptions], [tr(state, 'Hors enveloppes'), unallocatedSubscriptions]].forEach(([label, value]) => {
    const stat = element('span', undefined, 'budget-row__stat');
    stat.append(element('small', label), element('strong', money(value)));
    subscriptionsAmounts.append(stat);
  });
  subscriptionsCard.append(subscriptionsIdentity, iconButton(tr(state, 'Gérer les abonnements'), 'chevron-right', () => navigate('subscriptions-manage'), 'row-chevron'), subscriptionsAmounts);
  list.append(subscriptionsCard);

  const editor = document.createElement('dialog'); editor.className = 'visual-card budget-envelope-editor'; editor.setAttribute('aria-labelledby', 'budget-envelope-title');
  const editorForm = document.createElement('form'); editorForm.noValidate = true;
  const category = document.createElement('select'); Object.entries(budgetCategories).forEach(([key, label]) => { const option = element('option', tr(state, label)); option.value = key; option.disabled = Boolean(state.allocations[key]) && state.allocations[key] > 0; category.append(option); });
  const firstAvailable = [...category.options].find(option => !option.disabled);
  if (firstAvailable) category.value = firstAvailable.value;
  const amount = document.createElement('input'); amount.inputMode = 'decimal'; amount.required = true;
  amount.addEventListener('blur', () => formatInput(amount));
  const error = element('p', undefined, 'form-error'); error.id = 'budget-error'; error.setAttribute('role', 'alert'); amount.setAttribute('aria-describedby', error.id);
  const envelopeHeader = element('div', undefined, 'budget-dialog-header');
  const envelopeTitle = element('h2', tr(state, 'Nouvelle enveloppe')); envelopeTitle.id = 'budget-envelope-title';
  const envelopeClose = iconButton(tr(state, 'Fermer'), 'x', () => editor.close(), 'dialog-close');
  envelopeHeader.append(icon('house'), envelopeTitle, envelopeClose);
  const currentEnvelope = element('div', undefined, 'envelope-current-preview');
  const currentPlanned = previewRow(tr(state, 'Prévu actuellement'), '');
  const currentSpent = previewRow(tr(state, 'Dépensé'), '');
  const currentRemaining = previewRow(tr(state, 'Restant'), '');
  currentEnvelope.append(currentPlanned, currentSpent, currentRemaining);
  const amountSuggestionsTitle = element('h3', tr(state, 'Suggestions'));
  const envelopeSuggestions = element('div', undefined, 'budget-suggestions');
  const nextPreview = element('div', undefined, 'budget-editor-preview');
  const nextRemaining = previewRow(tr(state, 'Nouveau restant'), '');
  nextPreview.append(previewRow(tr(state, 'Montant déjà dépensé · conservé'), ''), nextRemaining);
  const envelopeWarning = element('p', undefined, 'budget-warning'); envelopeWarning.setAttribute('role', 'status'); envelopeWarning.setAttribute('aria-live', 'polite');
  const submit = actionButton(tr(state, 'Enregistrer'), null, 'wide-primary'); submit.type = 'submit';
  newBudgetTrigger.disabled = !firstAvailable;
  const spentInCategory = key => sumAmounts(state.transactions.filter(item => item.type === 'expense' && item.category === key && item.date.startsWith(monthKey)).map(item => item.amount));
  const updateEnvelopePreview = () => {
    const selected = category.value;
    envelopeHeader.firstChild.replaceWith(icon(categoryIcons[selected] || 'target'));
    const plannedNow = Number(state.allocations[selected]) || 0;
    const spent = spentInCategory(selected);
    const next = readAmount(amount);
    currentPlanned.lastChild.textContent = money(plannedNow);
    currentSpent.lastChild.textContent = money(spent);
    const remainingNow = plannedNow - spent;
    currentRemaining.firstChild.textContent = remainingNow < 0 ? tr(state, 'Dépassement actuel') : tr(state, 'Restant');
    currentRemaining.lastChild.textContent = money(Math.abs(remainingNow));
    nextPreview.firstChild.lastChild.textContent = money(spent);
    const remainingNext = next === null ? null : next - spent;
    nextRemaining.firstChild.textContent = remainingNext !== null && remainingNext < 0 ? tr(state, 'Dépassement après modification') : tr(state, 'Nouveau restant');
    nextRemaining.lastChild.textContent = remainingNext === null ? '—' : money(Math.abs(remainingNext));
    nextRemaining.lastChild.classList.toggle('is-negative', remainingNext !== null && remainingNext < 0);
    let allocationWarning = '';
    if (next !== null) {
      const totalAfter = summary.planned - plannedNow + next;
      if (remainingNext < 0) allocationWarning = fmt(state, 'Le nouveau montant est inférieur aux dépenses déjà réalisées ({spent}). Elles ne seront pas modifiées.', { spent: money(spent) });
      else if (totalAfter > state.budget) allocationWarning = fmt(state, 'Le total des enveloppes dépasserait le budget mensuel de {amount}.', { amount: money(totalAfter - state.budget) });
    }
    envelopeWarning.textContent = allocationWarning;
    envelopeWarning.hidden = !allocationWarning;
    envelopeSuggestions.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(next === Number(button.dataset.amount))));
  };
  const updateEnvelopeSuggestions = () => {
    const reference = Math.max(Number(state.allocations[category.value]) || 0, spentInCategory(category.value));
    const fallback = Math.max(1, Math.round(state.budget / 4));
    renderSuggestions(envelopeSuggestions, amountSuggestions(reference, state.currency, [1.25, 1.5, 1.667, 1.833], fallback), amount, state, updateEnvelopePreview);
  };
  revealEnvelopeEditor = () => { envelopeTitle.textContent = tr(state, editingCategory ? 'Modifier l’enveloppe' : 'Nouvelle enveloppe'); category.disabled = Boolean(editingCategory); if (!editingCategory) amount.value = ''; error.textContent = ''; updateEnvelopeSuggestions(); updateEnvelopePreview(); formatInput(amount); if (!editor.open) editor.showModal(); amount.focus({ preventScroll: true }); };
  category.addEventListener('change', () => { updateEnvelopeSuggestions(); updateEnvelopePreview(); });
  amount.addEventListener('input', updateEnvelopePreview);
  const envelopeContent = element('div', undefined, 'budget-dialog-content');
  envelopeContent.append(envelopeHeader, field(tr(state, 'Catégorie'), category), currentEnvelope, field(fmt(state, 'Nouveau montant ({currency})', { currency: state.currency }), amount), amountSuggestionsTitle, envelopeSuggestions, nextPreview, envelopeWarning, error);
  const envelopeActions = element('div', undefined, 'budget-dialog-actions');
  envelopeActions.append(actionButton(tr(state, 'Annuler'), () => editor.close(), 'secondary-wide'), submit);
  editorForm.append(envelopeContent, envelopeActions);
  editor.append(editorForm);
  editorForm.addEventListener('submit', async event => { event.preventDefault(); const value = readAmount(amount); if (value === null) { error.textContent = tr(state, 'Saisis un montant valide et positif ou nul.'); amount.setAttribute('aria-invalid', 'true'); return; } const updated = { ...state.allocations, [category.value]: value }; try { summarizeBudgets({ ...state, allocations: updated }, monthKey); } catch { error.textContent = tr(state, 'Le total est trop élevé.'); return; } const previous = { ...state.allocations }; state.allocations[category.value] = value; submit.disabled = true; try { if (!visualDemo) await persistBudgets(state); editor.close(); navigate('budgets'); } catch (exception) { state.allocations = previous; error.textContent = tr(state, exception.message || 'Impossible d’enregistrer le budget.'); } finally { submit.disabled = false; } });

  app.append(hero, overview, headingRow, list, editBudget, editor);
  heading.focus({ preventScroll: true });
}
