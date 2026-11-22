import { financeText as tr, financeLocale, financeFormat as fmt } from '../app/i18nFinance.js?v=full-i18n-profilefix-20261122';
import { monthlyDueDay } from './subscriptions.js';
import { savingsSummary } from './savings.js';
import { budgetCategories, summarizeBudgets } from './budgets.js';

export function nextSubscriptionDate(subscription, today = new Date()) {
  const year = today.getFullYear(), month = today.getMonth();
  let date = new Date(year, month, monthlyDueDay(year, month + 1, subscription.billingDay));
  if (date < new Date(year, month, today.getDate())) {
    const next = new Date(year, month + 1, 1);
    date = new Date(next.getFullYear(), next.getMonth(), monthlyDueDay(next.getFullYear(), next.getMonth() + 1, subscription.billingDay));
  }
  return date;
}

export function getNotifications(state, today = new Date()) {
  const alerts = state.preferences.alerts;
  const result = [];
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (alerts.subscriptions) state.subscriptions.forEach(subscription => {
    const due = nextSubscriptionDate(subscription, today);
    const days = Math.round((Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) - Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())) / 86400000);
    if (days <= 7) result.push({ id: `subscription:${subscription.name}:${due.getFullYear()}-${due.getMonth()+1}-${due.getDate()}`, text: fmt(state, '{name} est prévu le {date}.', {name:subscription.name,date:due.toLocaleDateString(financeLocale(state))}) });
  });
  if (alerts.budget) summarizeBudgets(state, month).items.filter(item => item.exceeded || item.linkedExceeded).forEach(item => {
    result.push({ id: `budget:${month}:${item.category}:${item.spent}:${item.limit}:${item.linked}`, text: fmt(state, 'Attention : {category} dépasse son enveloppe{suffix}.', {category:tr(state,budgetCategories[item.category] || item.category),suffix:item.linkedExceeded ? tr(state,' ou ses abonnements prévus') : ''}) });
  });
  if (alerts.savings) state.goals.forEach(goal => {
    if (goal.mode === 'free') return;
    const summary = savingsSummary(goal, today);
    if (summary.saved >= goal.target) result.push({ id: `savings:${goal.id}:${goal.target}`, text: fmt(state, 'Objectif atteint : {name}.', {name:goal.name}) });
  });
  return result.map(item => ({ ...item, id: `${item.id}:${state.currency || ''}` }));
}
