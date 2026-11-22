import { financeText as tr, financeLocale } from '../app/i18nFinance.js?v=full-i18n-finalfix-20261122';
import { actionButton, card, createHero } from '../components/financeUi.js';
import { currencyDigits, formatMoney, inputAmount } from '../domain/money.js';
import { monthlyDueDay, saveSubscription } from '../domain/subscriptions.js';
import { sumAmounts } from '../domain/money.js';
import { parseAmount } from '../domain/budget.js';
import { createSubscription, deleteSubscription, updateSubscription } from '../app/api.js';
import { applyServerState } from '../app/serverState.js';

const categories = { rent: 'Loyer', transport: 'Transport', groceries: 'Courses', unexpected: 'Imprévus' };

function field(label, type = 'text') {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const input = document.createElement('input');
  input.type = type; input.required = true;
  wrapper.append(input);
  return { wrapper, input };
}

export function createSubscriptionManagerPage(app, state, navigate) {
  app.replaceChildren();
  const demo = Boolean(state.demoFixture);
  const { hero, heading } = createHero(state, { title: tr(state, 'Abonnements'), subtitle: tr(state, 'Suis tes charges prévues sans prélèvement automatique.'), route: 'subscriptions-manage', navigate, back: true, backRoute: 'profile' });
  const summary = card('subscription-manager-summary');
  summary.append(document.createElement('strong'), document.createElement('span'));
  summary.firstChild.textContent = tr(state, 'Total mensuel prévisionnel');

  const list = card('subscription-manager-list');
  const formCard = card('subscription-manager-form');
  let editing = null;
  formCard.hidden = true;

  const renderForm = () => {
    formCard.replaceChildren();
    const title = document.createElement('h2'); title.textContent = editing ? tr(state, 'Modifier un abonnement') : tr(state, 'Ajouter un abonnement');
    const form = document.createElement('form'); form.className = 'subscription-manager-form-fields'; form.noValidate = true;
    const name = field(tr(state, 'Nom du service'));
    const amount = field(`${tr(state, 'Montant mensuel')} (${state.currency})`); amount.input.inputMode = 'decimal';
    const calendar = document.createElement('div');
    let billingDay = editing?.billingDay || null;
    let viewDate = new Date();
    const chosen = document.createElement('p');
    chosen.setAttribute('aria-live', 'polite');
    const drawCalendar = () => {
      calendar.replaceChildren();
      const year = viewDate.getFullYear(); const month = viewDate.getMonth();
      const navigation = document.createElement('div'); navigation.className = 'calendar-nav';
      const previous = actionButton('‹', () => { viewDate = new Date(year, month - 1, 1); drawCalendar(); }, 'calendar-arrow');
      previous.setAttribute('aria-label', tr(state, 'Mois précédent'));
      const next = actionButton('›', () => { viewDate = new Date(year, month + 1, 1); drawCalendar(); }, 'calendar-arrow');
      next.setAttribute('aria-label', tr(state, 'Mois suivant'));
      const title = document.createElement('strong'); title.textContent = new Intl.DateTimeFormat(financeLocale(state), { month: 'long', year: 'numeric' }).format(viewDate);
      navigation.append(previous, title, next);
      const days = document.createElement('div'); days.className = 'calendar-grid';
      (financeLocale(state).startsWith('en') ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D']).forEach(letter => { const label = document.createElement('span'); label.textContent = letter; days.append(label); });
      const offset = (new Date(year, month, 1).getDay() + 6) % 7;
      for (let index = 0; index < offset; index++) days.append(document.createElement('span'));
      for (let value = 1; value <= monthlyDueDay(year, month + 1, 31); value++) {
        const cell = actionButton(String(value), () => { billingDay = value; drawCalendar(); }, 'calendar-day');
        cell.setAttribute('aria-label', `${value} ${title.textContent}`); cell.setAttribute('aria-pressed', String(value === billingDay)); days.append(cell);
      }
      chosen.textContent = billingDay ? `${tr(state, 'Jour mensuel choisi : ')}${billingDay}${tr(state, '. Si le mois est plus court, paiement le dernier jour du mois.')}` : tr(state, 'Choisis un jour de paiement.');
      calendar.append(navigation, days);
    };
    drawCalendar();
    name.input.value = editing?.name || ''; amount.input.value = editing ? inputAmount(editing.amount, state.currency) : '';
    const allocationLabel = document.createElement('label'); allocationLabel.textContent = tr(state, 'Compris dans une allocation existante ?');
    const allocation = document.createElement('select');
    const none = document.createElement('option'); none.value = ''; none.textContent = tr(state, 'Non, charge distincte'); allocation.append(none);
    Object.entries(categories).forEach(([key, label]) => { const option = document.createElement('option'); option.value = key; option.textContent = tr(state, label); allocation.append(option); });
    allocation.value = editing?.includedIn || ''; allocationLabel.append(allocation);
    const error = document.createElement('p'); error.className = 'form-error'; error.setAttribute('role', 'alert');
    const submit = actionButton(tr(state, 'Enregistrer')); submit.type = 'submit';
    const cancel = actionButton(tr(state, 'Annuler'), () => { editing = null; formCard.hidden = true; }, 'secondary-wide');
    form.append(name.wrapper, calendar, chosen, amount.wrapper, allocationLabel, error, submit, cancel);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const entry = { name: name.input.value, amount: parseAmount(amount.input.value, currencyDigits(state.currency)), billingDay, includedIn: allocation.value || null };
      try {
        const candidate = saveSubscription(state.subscriptions, entry, editing?.name || null);
        const saved = candidate[candidate.length - 1];
        const result = editing ? await updateSubscription(editing.id, saved) : await createSubscription(saved);
        applyServerState(state, result.state); editing = null; render(); formCard.hidden = true;
      } catch (exception) { error.textContent = tr(state, exception.message || 'Impossible d’enregistrer l’abonnement.'); }
    });
    formCard.hidden = false;
    formCard.append(title, form);
  };

  const render = () => {
    list.replaceChildren();
    const title = document.createElement('h2'); title.textContent = tr(state, 'Mes abonnements'); list.append(title);
    if (!demo) list.append(actionButton(tr(state, 'Ajouter un abonnement'), () => { editing = null; renderForm(); }, 'secondary-wide'));
    if (!state.subscriptions.length) { const empty = document.createElement('p'); empty.className = 'empty-copy'; empty.textContent = tr(state, 'Aucun abonnement pour le moment.'); list.append(empty); }
    state.subscriptions.forEach(subscription => {
      const item = document.createElement('article'); item.className = 'subscription-manager-card';
      const copy = document.createElement('div'); const name = document.createElement('strong'); name.textContent = subscription.name;
      const due = document.createElement('span'); const now = new Date(); const dueDay = monthlyDueDay(now.getFullYear(), now.getMonth() + 1, subscription.billingDay);
      due.textContent = `${tr(state, 'Mensuel')} · ${tr(state, 'Prochaine échéance')} : ${new Date(now.getFullYear(), now.getMonth(), dueDay).toLocaleDateString(financeLocale(state), { day: 'numeric', month: 'short' })}`;
      copy.append(name, due);
      const amount = document.createElement('strong'); amount.textContent = formatMoney(subscription.amount, state.currency);
      if (!demo) {
        const actions = document.createElement('div'); actions.className = 'subscription-manager-actions';
        actions.append(actionButton(tr(state, 'Modifier'), () => { editing = subscription; renderForm(); }, 'row-action'), actionButton(tr(state, 'Supprimer'), async () => {
          if (!window.confirm(tr(state, 'Supprimer cet abonnement ?'))) return;
          try { const result = await deleteSubscription(subscription.id); applyServerState(state, result.state); render(); }
          catch (exception) { window.alert(tr(state, exception.message || 'Impossible de supprimer l’abonnement.')); }
        }, 'row-action'));
        item.append(copy, amount, actions);
      } else item.append(copy, amount);
      list.append(item);
    });
    summary.lastChild.textContent = formatMoney(sumAmounts(state.subscriptions.map(item => item.amount)), state.currency);
  };

  render();
  if (demo) { const note = document.createElement('p'); note.className = 'empty-copy'; note.textContent = tr(state, 'Mode démo : aucune donnée n’est envoyée.'); app.append(hero, summary, list, note); }
  else app.append(hero, summary, list, formCard);
  heading.focus({ preventScroll: true });
}
