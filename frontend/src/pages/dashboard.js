import { financeText as tr, financeLocale, financeFormat as fmt } from '../app/i18nFinance.js?v=full-i18n-20261122';
import { formatMoney } from '../domain/money.js';
import { transactionTotals, transactionCategories } from '../domain/transactions.js';
import { budgetCategories } from '../domain/budgets.js';
import { getNotifications, nextSubscriptionDate } from '../domain/notifications.js';
import { actionButton, card, createBudgetRing, createHero, icon, iconActionButton, iconButton } from '../components/financeUi.js';
import { isDashboardDemoState } from '../app/dashboardDemoFixture.js';
import { markNotificationRead, syncNotifications } from '../app/api.js';

const categoryIcons = { rent: 'house', transport: 'bus-front', groceries: 'shopping-cart', unexpected: 'triangle-alert' };

function money(value, state, visible) {
  if (!visible) return '••••';
  return formatMoney(value, state.currency, state.currency === 'XOF' ? 'code' : 'symbol');
}

function metric(title, value, iconName, tone = '') {
  const element = document.createElement('div');
  element.className = `dashboard-metric ${tone}`.trim();
  element.append(icon(iconName), document.createElement('div'));
  const copy = element.lastChild;
  const label = document.createElement('strong');
  label.textContent = title;
  const amount = document.createElement('span');
  amount.textContent = value;
  copy.append(label, amount);
  return element;
}

function transactionRow(item, state, visible) {
  const row = document.createElement('article');
  row.className = `dashboard-transaction ${item.type === 'income' ? 'is-income' : ''}`;
  row.append(icon(item.type === 'income' ? 'arrow-down' : 'arrow-up', 'transaction-icon'));
  const details = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = item.description || tr(state, transactionCategories[item.category] || item.category);
  const category = document.createElement('span');
  category.textContent = item.dashboardSubtitle || (item.type === 'income' ? tr(state, 'Salaire') : tr(state, transactionCategories[item.category] || item.category));
  details.append(name, category);
  const date = document.createElement('time');
  date.textContent = new Intl.DateTimeFormat(financeLocale(state), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(item.date + 'T00:00:00Z'));
  const amount = document.createElement('strong');
  amount.className = 'transaction-amount';
  amount.textContent = `${item.type === 'income' ? '+' : '−'}${money(item.amount, state, visible)}`;
  row.append(details, date, amount);
  return row;
}

export function createDashboardPage(app, state, navigate) {
  app.replaceChildren();
  const visible = state.dashboardAmountsVisible !== false;
  const demo = isDashboardDemoState(state);
  const totals = transactionTotals(state.transactions);
  const budgetRemaining = state.budget - totals.expense;
  const title = demo ? tr(state, state.dashboardDemoTitle) : tr(state, 'Vue d’ensemble');
  const subtitle = demo ? tr(state, state.dashboardDemoSubtitle) : tr(state, 'Budget du mois');
  const heroResult = createHero(state, { title, subtitle, route: 'dashboard', navigate });
  if (state.serverLoadError) {
    const errorCard = card('dashboard-error-card');
    const errorTitle = document.createElement('h2');
    errorTitle.textContent = tr(state, 'Données temporairement indisponibles');
    const errorCopy = document.createElement('p');
    errorCopy.setAttribute('role', 'alert');
    errorCopy.textContent = tr(state, 'Moni n’a pas pu charger tes données. Réessaie dans quelques instants.');
    errorCard.append(errorTitle, errorCopy, actionButton(tr(state, 'Réessayer'), () => window.location.reload(), 'secondary-wide'));
    app.append(heroResult.hero, errorCard);
    heroResult.heading.focus({ preventScroll: true });
    return;
  }
  const balance = card('balance-card');
  const balanceHeader = document.createElement('div');
  balanceHeader.className = 'balance-card__header';
  const balanceLabel = document.createElement('span');
  balanceLabel.textContent = tr(state, 'Budget restant');
  const toggle = iconButton(visible ? tr(state, 'Masquer les montants') : tr(state, 'Afficher les montants'), 'eye', () => {
    state.dashboardAmountsVisible = !visible;
    createDashboardPage(app, state, navigate);
    app.querySelector('[data-amount-toggle]')?.focus();
  }, 'balance-toggle');
  toggle.dataset.amountToggle = '';
  toggle.setAttribute('aria-pressed', String(!visible));
  balanceHeader.append(balanceLabel, toggle);
  const balanceValue = document.createElement('strong');
  balanceValue.className = 'balance-card__value';
  balanceValue.textContent = money(demo ? state.dashboardBalance : budgetRemaining, state, visible);
  balance.append(balanceHeader, balanceValue);

  const metrics = document.createElement('section');
  metrics.className = 'dashboard-metrics';
  metrics.append(
    metric(tr(state, 'Revenus'), money(totals.income, state, visible), 'arrow-down', 'is-income'),
    metric(tr(state, 'Dépenses'), `−${money(totals.expense, state, visible)}`, 'arrow-up', 'is-expense'),
  );

  const notifications = getNotifications(state);
  const read = state.readNotifications || [];
  const notificationButton = actionButton(fmt(state, 'Notifications ({n} non lue(s))', { n: notifications.filter(item => !read.includes(item.id)).length }), null, 'notification-button');
  notificationButton.dataset.alertToggle = '';
  if (demo) notificationButton.classList.add('sr-only');
  notificationButton.setAttribute('aria-expanded', 'false');
  const notificationPanel = card('notification-panel');
  notificationPanel.hidden = true;
  notificationPanel.id = 'dashboard-notifications';
  notificationButton.setAttribute('aria-controls', notificationPanel.id);
  notificationButton.addEventListener('click', () => {
    notificationPanel.hidden = !notificationPanel.hidden;
    notificationButton.setAttribute('aria-expanded', String(!notificationPanel.hidden));
  });
  const notificationTitle = document.createElement('h2');
  notificationTitle.textContent = tr(state, 'Notifications de démonstration');
  notificationPanel.append(notificationTitle);
  if (!notifications.length) {
    const empty = document.createElement('p');
    empty.textContent = tr(state, 'Aucune notification actuellement.');
    notificationPanel.append(empty);
  } else notifications.forEach(item => {
    const line = document.createElement('div');
    line.className = 'notification-line';
    const text = document.createElement('p');
    text.textContent = item.text;
    const markRead = actionButton(tr(state, 'Marquer comme lue'), () => {
      const complete = () => { state.readNotifications = [...new Set([...(state.readNotifications || []), item.id])]; createDashboardPage(app, state, navigate); };
      if (demo) complete(); else markNotificationRead(item.id).then(complete).catch(() => {});
    }, 'notification-read-button');
    line.append(text, markRead);
    notificationPanel.append(line);
  });

  const budgetCard = card('budget-card');
  const budgetTitle = document.createElement('h2');
  budgetTitle.textContent = tr(state, 'Budget mensuel');
  budgetCard.append(budgetTitle);
  const budgetBody = document.createElement('div');
  budgetBody.className = 'budget-card__body';
  const budgetPercent = state.budget > 0 ? Math.min(100, Math.round((totals.expense / state.budget) * 100)) : 0;
  if (visible && state.budget > 0) budgetBody.append(createBudgetRing({ progress: budgetPercent, label: tr(state, 'utilisé'), description: tr(state, 'Part du budget consommée') }));
  else if (visible) {
    const emptyBudget = document.createElement('p');
    emptyBudget.className = 'empty-copy dashboard-no-budget';
    emptyBudget.textContent = tr(state, 'Aucun budget défini.');
    budgetBody.append(emptyBudget, actionButton(tr(state, 'Définir un budget'), () => navigate('budgets'), 'text-button'));
  }
  else {
    const chartHidden = document.createElement('p');
    chartHidden.className = 'empty-copy';
    chartHidden.textContent = tr(state, 'Graphique masqué');
    budgetBody.append(chartHidden);
  }
  const budgetStats = document.createElement('div');
  budgetStats.className = 'budget-card__stats';
  [['Dépensé', money(totals.expense, state, visible)], [budgetRemaining < 0 ? 'Dépassement' : 'Restant', money(Math.abs(budgetRemaining), state, visible)], ['Budget total', money(state.budget, state, visible)]].forEach(([label, value]) => {
    const line = document.createElement('p');
    line.append(document.createElement('span'), document.createElement('strong'));
    line.firstChild.textContent = label;
    line.lastChild.textContent = value;
    budgetStats.append(line);
  });
  budgetBody.append(budgetStats);
  budgetCard.append(budgetBody);

  const due = state.subscriptions.map(subscription => ({ subscription, date: nextSubscriptionDate(subscription) })).sort((a, b) => a.date - b.date)[0];
  const dueCard = card('due-card');
  const dueTitle = document.createElement('h2');
  dueTitle.textContent = tr(state, 'Prochaine échéance');
  dueCard.append(dueTitle);
  const dueService = document.createElement('div');
  dueService.className = 'due-card__service';
  const dueName = document.createElement('strong');
  dueName.textContent = due ? due.subscription.name : tr(state, 'Aucun abonnement');
  if (due) {
    const serviceAssets = { Netflix: 'netflix.svg', Canva: 'canva.svg' };
    if (serviceAssets[due.subscription.name]) {
      const logo = document.createElement('img');
      logo.src = `./public/assets/brands/${serviceAssets[due.subscription.name]}`;
      logo.alt = '';
      logo.setAttribute('aria-hidden', 'true');
      logo.addEventListener('error', () => logo.remove(), { once: true });
      dueService.append(logo);
    }
  }
  dueService.append(dueName);
  const dueDate = document.createElement('p');
  dueDate.textContent = due ? due.date.toLocaleDateString(financeLocale(state), { day: 'numeric', month: 'short', year: 'numeric' }) : tr(state, 'Ajoute tes charges prévues pendant la configuration.');
  dueCard.append(dueService, dueDate);
  if (due) {
    const dueAmount = document.createElement('strong');
    dueAmount.className = 'due-card__amount';
    dueAmount.textContent = money(due.subscription.amount, state, visible);
    dueCard.append(dueAmount);
  }
  dueCard.append(actionButton(tr(state, 'Gérer les abonnements'), () => navigate('subscriptions-manage'), 'text-button'));
  const allocationCard = card('allocation-card');
  const allocationHeading = document.createElement('div');
  allocationHeading.className = 'card-heading-row';
  const allocationTitle = document.createElement('h2');
  allocationTitle.textContent = tr(state, 'Répartition du budget');
  allocationHeading.append(allocationTitle, iconButton(tr(state, 'Voir les budgets'), 'chevron-right', () => navigate('budgets'), 'allocation-link'));
  const allocationList = document.createElement('div');
  allocationList.className = 'dashboard-allocations';
  const allocations = Object.entries(state.allocations || {}).filter(([, amount]) => Number(amount) > 0);
  if (!allocations.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = tr(state, 'Aucune enveloppe définie.');
    allocationList.append(empty);
  } else allocations.forEach(([category, amount]) => {
    const item = document.createElement('article');
    item.className = 'dashboard-allocation';
    item.append(icon(categoryIcons[category] || 'target'), document.createElement('div'));
    item.lastChild.append(document.createElement('strong'), document.createElement('span'));
    item.lastChild.firstChild.textContent = tr(state, budgetCategories[category] || category);
    item.lastChild.lastChild.textContent = money(amount, state, visible);
    allocationList.append(item);
  });
  allocationCard.append(allocationHeading, allocationList);

  const recentHeading = document.createElement('div');
  recentHeading.className = 'section-heading-row dashboard-recent-heading';
  const recentTitle = document.createElement('h2');
  recentTitle.textContent = tr(state, 'Dernières transactions');
  const viewAll = actionButton(tr(state, 'Voir tout'), () => navigate('transactions'), 'text-button');
  viewAll.append(icon('chevron-right'));
  recentHeading.append(recentTitle, viewAll);
  const recent = card('recent-card');
  const recentTransactions = [...state.transactions]
    .filter(item => !demo || state.dashboardVisibleTransactionIds.includes(item.id))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  if (!recentTransactions.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = tr(state, 'Aucune transaction enregistrée.');
    recent.append(empty);
  } else recentTransactions.forEach(item => recent.append(transactionRow(item, state, visible)));

  app.append(heroResult.hero, balance, metrics, notificationButton, notificationPanel, budgetCard, allocationCard, dueCard, recentHeading, recent);
  if (!demo) syncNotifications(notifications).then(result => {
    if (app.isConnected) window.dispatchEvent(new CustomEvent('moni:notifications-updated', { detail: result }));
    const current = new Set(notifications.map(item => item.id));
    state.readNotifications = (result.notifications || []).filter(item => current.has(item.id) && item.read).map(item => item.id);
    notificationButton.textContent = fmt(state, 'Notifications ({n} non lue(s))', { n: notifications.filter(item => !state.readNotifications.includes(item.id)).length });
  }).catch(() => {});
  heroResult.heading.focus({ preventScroll: true });
}
