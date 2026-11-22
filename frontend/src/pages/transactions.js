import { financeText as tr, financeLocale, financeFormat as fmt } from '../app/i18nFinance.js?v=full-i18n-finalfix-20261122';
import { parseAmount } from '../domain/budget.js';
import { currencyDigits, formatMoney, formatAmount, inputAmount } from '../domain/money.js';
import { expenseCategories, incomeCategories, transactionCategories, saveTransaction, filterTransactions, transactionTotals } from '../domain/transactions.js';
import { actionButton, card, createHero, icon, iconActionButton, iconButton } from '../components/financeUi.js';
import { createDashboardDemoState } from '../app/dashboardDemoFixture.js';
import { createTransaction, updateTransaction, deleteTransaction } from '../app/api.js';
import { applyServerState } from '../app/serverState.js';

let editingId = null;
let filters = { type: 'all', month: '', search: '' };
const categoryIcons = { rent: 'house', transport: 'bus-front', groceries: 'shopping-cart', unexpected: 'triangle-alert' };

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function field(label, control, iconName, suffixText) {
  const wrapper = node('label', undefined, 'visual-field');
  const caption = node('span', label, 'visual-field__label');
  wrapper.append(caption);
  const shell = node('span', undefined, 'visual-field__control');
  if (iconName) shell.append(icon(iconName));
  shell.append(control);
  if (suffixText) {
    const suffix = node('span', suffixText, 'visual-field__suffix');
    suffix.style.cssText = 'padding-right: 16px; color: var(--navy); font-weight: 700;';
    shell.append(suffix);
  }
  wrapper.append(shell);
  return wrapper;
}

function option(value, label) {
  const element = node('option', label);
  element.value = value;
  return element;
}

function transactionTotal(label, value, type) {
  const item = node('span', undefined, `dashboard-metric is-${type}`);
  const copy = node('div');
  copy.append(node('small', label), node('strong', value));
  item.append(icon(type === 'income' ? 'arrow-down' : 'arrow-up'), copy);
  return item;
}

function money(value, state) {
  return formatMoney(value, state.currency, state.currency === 'XOF' ? 'code' : 'symbol');
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isVisualDemo() {
  return new URLSearchParams(location.hash.split('?')[1] || '').get('demo') === 'dashboard';
}

function transactionIcon(item) {
  return item.type === 'income' ? 'arrow-down' : 'arrow-up';
}

function transactionTime(item) {
  return { 'demo-groceries': '14:32', 'demo-spotify': '10:15', 'demo-transport': '18:40' }[item.id] || '09:00';
}

function transactionRow(item, state, openEditor, draw) {
  const row = node('article', undefined, 'transaction-row');
  row.append(icon(transactionIcon(item), 'transaction-row__icon'));
  const details = node('div', undefined, 'transaction-row__details');
  const name = item.description || tr(state, transactionCategories[item.category]);
  const subtitle = item.dashboardSubtitle || (item.type === 'income' ? tr(state, 'Salaire') : tr(state, transactionCategories[item.category]));
  details.append(node('strong', name));
  if (subtitle && subtitle.trim().toLocaleLowerCase(financeLocale(state)) !== name.trim().toLocaleLowerCase(financeLocale(state))) details.append(node('span', subtitle));
  const amount = node('strong', `${item.type === 'income' ? '+' : '−'}${money(item.amount, state)}`, `transaction-row__amount ${item.type === 'income' ? 'is-income' : 'is-expense'}`);
  if (isVisualDemo()) details.append(node('time', transactionTime(item)));
  const actions = node('details', undefined, 'transaction-row__actions');
  const menu = node('summary', '•••');
  menu.setAttribute('aria-label', `${tr(state, 'Actions')} : ${name}`);
  actions.append(menu, actionButton(tr(state, 'Modifier'), () => openEditor(item.id), 'row-action'), actionButton(tr(state, 'Supprimer'), async () => {
    if (window.confirm(tr(state, 'Supprimer cette transaction ?'))) {
      try { await deleteTransaction(item.id); state.transactions = state.transactions.filter(entry => entry.id !== item.id); draw(); }
      catch (exception) { window.alert(tr(state, exception.message || 'Impossible de supprimer la transaction.')); }
    }
  }, 'row-action'));
  row.append(details, node('div', undefined, 'transaction-row__meta'));
  row.lastChild.append(amount, isVisualDemo() ? node('span', '•••', 'transaction-row__more') : actions);
  return row;
}

function segmentedType(state, value, onChange) {
  const wrapper = node('div', undefined, 'segmented-control');
  const select = document.createElement('select');
  select.setAttribute('aria-label', tr(state, 'Type'));
  select.className = 'sr-only';
  select.append(option('all', tr(state, 'Toutes')), option('expense', tr(state, 'Dépenses')), option('income', tr(state, 'Revenus')));
  select.value = value;
  [['all', 'Toutes', 'list'], ['expense', 'Dépenses', 'trending-down'], ['income', 'Revenus', 'trending-up']].forEach(([key, label, iconName]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'segmented-control__item';
    if (key === value) button.classList.add('is-active');
    button.append(node('span', tr(state, label)));
    button.addEventListener('click', () => { select.value = key; wrapper.querySelectorAll('button').forEach(item => item.classList.remove('is-active')); button.classList.add('is-active'); onChange(key); });
    wrapper.append(button);
  });
  wrapper.append(select);
  return wrapper;
}

export function createTransactionsPage(app, state, navigate) {
  const route = location.hash.slice(1).split('?')[0];
  const viewState = isVisualDemo() ? createDashboardDemoState(state) : state;
  app.replaceChildren();
  if (route === 'transaction-edit' && editingId && !viewState.transactions.some(item => item.id === editingId)) { editingId = null; navigate('transactions'); return; }
  const { hero, heading } = createHero(viewState, { title: tr(viewState, 'Transactions'), subtitle: '', route: 'transactions', navigate });
  const dialog = document.createElement('dialog');
  dialog.className = 'transaction-editor-dialog';
  const dialogTitle = node('h2', undefined, 'transaction-editor-dialog__title');
  dialogTitle.id = 'transaction-editor-title';
  dialog.setAttribute('aria-labelledby', dialogTitle.id);
  const close = iconButton(tr(viewState, 'Fermer'), 'x', () => dialog.close(), 'transaction-editor-dialog__close');
  const dialogHeader = node('header', undefined, 'transaction-editor-dialog__header');
  dialogHeader.append(dialogTitle, close);
  const body = node('div', undefined, 'transaction-editor-dialog__body');
  dialog.append(dialogHeader, body);
  let returnFocus = null;
  dialog.addEventListener('close', () => {
    if (returnFocus?.isConnected) returnFocus.focus();
    else app.querySelector('.transactions-add-button')?.focus();
  });
  const openEditor = id => {
    editingId = id;
    returnFocus = document.activeElement;
    dialogTitle.textContent = tr(viewState, id ? 'Modifier la transaction' : 'Ajouter une transaction');
    body.replaceChildren(editor(viewState, () => { dialog.close(); transactions.draw(); app.querySelector('.transactions-add-button')?.focus(); }, () => dialog.close()));
    dialog.showModal();
    body.querySelector('input')?.focus({ preventScroll: true });
  };
  const transactions = list(viewState, openEditor);
  hero.append(transactions.searchButton);
  app.append(hero, transactions.section, dialog);
  transactions.draw();
  heading.focus({ preventScroll: true });
  if (route === 'transaction-edit') openEditor(editingId);
}

function list(state, openEditor) {
  const section = node('section', undefined, 'transactions-card');
  const toolbar = node('div', undefined, 'transactions-toolbar');
  const filterTabs = segmentedType(state, filters.type, value => { filters.type = value; draw(); });
  const searchButton = iconActionButton(tr(state, 'Rechercher'), 'search', () => { searchField.hidden = !searchField.hidden; searchButton.setAttribute('aria-expanded', String(!searchField.hidden)); if (!searchField.hidden) search.focus(); }, 'toolbar-icon-button');
  searchButton.setAttribute('aria-label', tr(state, 'Rechercher'));
  searchButton.title = tr(state, 'Rechercher');
  searchButton.setAttribute('aria-expanded', 'false');
  toolbar.append(filterTabs);
  const filtersRow = node('div', undefined, 'transactions-filters');
  const month = document.createElement('input');
  month.type = 'month'; month.value = filters.month; month.setAttribute('aria-label', tr(state, 'Mois'));
  const period = node('details', undefined, 'transaction-period');
  const periodLabel = node('summary');
  const periodControls = node('div', undefined, 'transaction-period__controls');
  const clearPeriod = actionButton(tr(state, 'Toutes les périodes'), () => { month.value = ''; draw(); period.open = false; }, 'text-button');
  periodControls.append(month, clearPeriod);
  period.append(periodLabel, periodControls);
  const search = document.createElement('input');
  search.type = 'search'; search.value = filters.search; search.placeholder = tr(state, 'Rechercher'); search.setAttribute('aria-label', tr(state, 'Recherche'));
  const searchField = field(tr(state, 'Recherche'), search, 'search');
  searchField.hidden = true;
  filtersRow.append(period, searchField);
  const totals = node('div', undefined, 'transaction-summary');
  const results = node('div', undefined, 'transaction-results');
  const draw = () => {
    filters = { type: filters.type, month: month.value, search: search.value };
    periodLabel.textContent = month.value ? new Intl.DateTimeFormat(financeLocale(state), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month.value}-01T00:00:00Z`)) : tr(state, 'Toutes les périodes');
    const items = filterTransactions(state.transactions, { type: filters.type, month: filters.month, search: '' }).filter(item => `${item.description} ${tr(state, transactionCategories[item.category])}`.toLocaleLowerCase(financeLocale(state)).includes(filters.search.trim().toLocaleLowerCase(financeLocale(state))));
    const visibleItems = isVisualDemo() ? items.filter(item => item.id !== 'demo-history') : items;
    const summary = transactionTotals(items);
    totals.replaceChildren(transactionTotal(tr(state, 'Revenus'), money(summary.income, state), 'income'), transactionTotal(tr(state, 'Dépenses'), money(summary.expense, state), 'expense'));
    results.replaceChildren();
    if (!visibleItems.length) results.append(node('p', tr(state, 'Aucune transaction pour cette sélection.'), 'empty-copy'));
    let previousDate = '';
    let dayCard;
    visibleItems.forEach(item => {
      if (item.date !== previousDate) {
        const dayItems = visibleItems.filter(entry => entry.date === item.date);
        const dayTotals = transactionTotals(dayItems);
        const dayNet = dayTotals.income - dayTotals.expense;
        const heading = node('h2', undefined, 'transaction-date');
        heading.append(node('span', new Intl.DateTimeFormat(financeLocale(state), { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${item.date}T00:00:00Z`))), node('strong', `${dayNet > 0 ? '+' : dayNet < 0 ? '−' : ''}${money(Math.abs(dayNet), state)}`, dayNet < 0 ? 'is-expense' : 'is-income'));
        dayCard = node('section', undefined, 'transaction-day');
        dayCard.append(heading);
        results.append(dayCard); previousDate = item.date;
      }
      dayCard.append(transactionRow(item, state, openEditor, draw));
    });
  };
  month.addEventListener('change', () => { draw(); period.open = false; }); search.addEventListener('input', draw);
  const addButton = iconButton(tr(state, 'Ajouter une transaction'), 'plus', () => openEditor(null), 'transactions-add-button');
  section.append(totals, toolbar, filtersRow, results);
  toolbar.append(addButton);
  return { section, draw, searchButton };
}

function editor(state, onSaved, onCancel) {
  const current = state.transactions.find(item => item.id === editingId) || (isVisualDemo() ? { id: 'demo-add', type: 'expense', amount: 12500, category: 'groceries', date: '2026-11-15', description: '' } : undefined);
  const form = node('form', undefined, 'visual-form transaction-editor');
  form.noValidate = true;
  const type = document.createElement('select');
  type.append(option('expense', tr(state, 'Dépense')), option('income', tr(state, 'Revenu'))); type.value = current?.type || 'expense';
  const typeControl = node('div', undefined, 'transaction-type-control');
  [['expense', 'Dépense', 'arrow-up'], ['income', 'Revenu', 'arrow-down']].forEach(([value, label, iconName]) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'transaction-type-control__item'; button.dataset.transactionType = value; if (type.value === value) button.classList.add('is-active'); button.append(icon(iconName), node('span', tr(state, label))); button.addEventListener('click', () => { if (type.value === value) return; type.value = value; category.value = ''; updateType(); typeControl.querySelectorAll('button').forEach(item => item.classList.remove('is-active')); button.classList.add('is-active'); }); typeControl.append(button);
  });
  type.className = 'sr-only'; type.setAttribute('aria-label', tr(state, 'Type')); typeControl.append(type);
  const amount = document.createElement('input'); amount.inputMode = 'decimal'; amount.value = current ? inputAmount(current.amount, state.currency) : ''; amount.required = true;
  const category = document.createElement('select'); category.required = true; category.append(option('', tr(state, 'Choisir une catégorie')));
  const updateCategories = () => { const choices = type.value === 'income' ? incomeCategories : expenseCategories; const selected = category.value || current?.category || ''; category.replaceChildren(option('', tr(state, 'Choisir une catégorie'))); Object.entries(choices).forEach(([value, label]) => category.append(option(value, tr(state, label)))); if (type.value === 'income' && current && Object.hasOwn(expenseCategories, selected)) category.append(option(selected, tr(state, transactionCategories[selected]))); category.value = selected; };
  updateCategories(); category.value = current?.category || '';
  const date = document.createElement('input'); date.type = 'date'; date.value = current?.date || today(); date.required = true;
  const description = document.createElement('input'); description.maxLength = 200; description.value = current?.description || '';
  const error = node('p', undefined, 'form-error'); error.id = 'transaction-error'; error.setAttribute('role', 'alert');
  [amount, date, category, type, description].forEach(control => control.setAttribute('aria-describedby', error.id));
  const categoryNote = node('p', undefined, 'transaction-category-note');
  const updateType = () => {
    updateCategories();
    description.placeholder = tr(state, type.value === 'income' ? 'Ex. : Salaire' : 'Ex. : Supermarché du quartier');
    categoryNote.textContent = '';
    categoryNote.hidden = type.value !== 'income';
  };
  updateCategories();
  updateType();
  const group = new Intl.NumberFormat(financeLocale(state)).formatToParts(1000).find(part => part.type === 'group')?.value || '';
  const readAmount = () => parseAmount(group ? amount.value.split(group).join('') : amount.value, currencyDigits(state.currency));
  const formatInput = () => { const value = readAmount(); if (value !== null) amount.value = formatAmount(value, state.currency); };
  amount.addEventListener('blur', formatInput);
  formatInput();
  const submit = iconActionButton(tr(state, 'Enregistrer la transaction'), 'plus', null, 'wide-primary'); submit.type = 'submit';
  form.append(typeControl, field(tr(state, 'Montant'), amount, null, state.currency), field(tr(state, 'Catégorie'), category), categoryNote, field(tr(state, 'Date'), date), field(tr(state, 'Description facultative'), description, 'note'), error, submit, actionButton(tr(state, 'Annuler'), onCancel, 'secondary-wide'));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const entry = { id: current?.id || crypto.randomUUID(), type: type.value, amount: readAmount(), category: category.value, date: date.value, description: description.value.trim() };
    const previous = state.transactions;
    submit.disabled = true;
    try {
      state.transactions = saveTransaction(state.transactions, entry);
      transactionTotals(state.transactions);
      const result = current ? await updateTransaction(current.id, entry) : await createTransaction(entry);
      applyServerState(state, result.state);
      editingId = null;
      onSaved();
    } catch (exception) {
      state.transactions = previous;
      error.textContent = tr(state, exception.message);
      amount.setAttribute('aria-invalid', 'true');
      error.tabIndex = -1;
      error.focus();
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}
