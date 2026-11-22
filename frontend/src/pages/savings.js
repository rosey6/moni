import { financeText as tr, financeLocale, financeFormat as fmt } from '../app/i18nFinance.js?v=full-i18n-savingsfix-20261122';
import { parseAmount } from '../domain/budget.js';
import { currencyDigits, formatAmount, formatMoney, inputAmount } from '../domain/money.js';
import { savingsSummary, totalSavings, validDate } from '../domain/savings.js';
import { actionButton, card, createHero, icon, iconActionButton } from '../components/financeUi.js';
import { createDashboardDemoState } from '../app/dashboardDemoFixture.js';
import { createGoal, updateGoal, deleteGoal, saveContribution, deleteContribution } from '../app/api.js';
import { applyServerState } from '../app/serverState.js';

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function field(form, label, type, value = '', iconName = '', suffix = '') {
  const wrapper = node('label', undefined, 'visual-field goal-field');
  wrapper.append(node('span', label, 'visual-field__label'));
  const shell = node('span', undefined, 'visual-field__control');
  if (iconName) shell.append(icon(iconName));
  const input = document.createElement('input'); input.type = type; input.value = value;
  shell.append(input);
  if (suffix) {
    input.style.flex = '1'; input.style.minWidth = '0';
    const suffixNode = node('span', suffix, 'visual-field__suffix');
    suffixNode.style.padding = '0 16px 0 12px'; suffixNode.style.borderLeft = '1px solid #c9c5ce'; suffixNode.style.color = 'var(--navy-soft)';
    shell.append(suffixNode);
  }
  wrapper.append(shell); form.append(wrapper); return input;
}

export function savingsDemoRequested(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  return new URLSearchParams(hash.split('?')[1] || '').get('demo') === 'dashboard';
}

export function createSavingsViewState(state, demo = savingsDemoRequested()) {
  if (!demo) return state;
  const demoState = createDashboardDemoState(state);
  const sourceGoal = demoState.goals[0];
  if (sourceGoal) {
    demoState.goals = [
      { ...sourceGoal, mode: 'goal', name: 'Voyage', target: 150000, date: '2027-06-30', contributions: [{ id: 'demo-voyage', amount: 30000 }] },
      { ...sourceGoal, id: 'demo-computer', mode: 'goal', name: 'Ordinateur', target: 300000, date: '2027-12-31', contributions: [{ id: 'demo-computer-saving', amount: 30000 }] },
      { id: 'demo-free', mode: 'free', name: 'Épargne libre', target: null, date: null, contributions: [{ id: 'demo-free-contribution', amount: 25000 }] },
    ];
  }
  return demoState;
}

function amount(raw, currency, allowZero = false) {
  const locale = document.documentElement.lang === 'en' ? 'en-US' : 'fr-FR';
  const group = new Intl.NumberFormat(locale).formatToParts(1000).find(part => part.type === 'group')?.value || '';
  const value = parseAmount(group ? String(raw).split(group).join('') : raw, currencyDigits(currency));
  if (value === null || (!allowZero && value === 0)) throw new Error(`Saisis un montant valide${allowZero ? '.' : ' supérieur à zéro.'}`);
  return value;
}

function localDate() {
  const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createSavingsPage(app, state, navigate) {
  // Le mode démo explicite réutilise la fixture Dashboard sans polluer l’état réel.
  const viewState = createSavingsViewState(state);
  const money = value => formatMoney(value, viewState.currency, viewState.currency === 'XOF' ? 'code' : 'symbol');
  const route = location.hash.slice(1).split('?')[0];
  let editingGoal = null;
  let editorMode = 'objective';
  const renderList = () => {
    app.replaceChildren();
    const { hero, heading } = createHero(viewState, { title: tr(viewState, 'Épargne'), subtitle: tr(viewState, 'Suis tes objectifs et fais grandir ton épargne.'), route: 'savings', navigate });
    const summary = card('savings-summary');
    summary.append(icon('piggy-bank', 'summary-icon'), node('div', undefined, 'savings-summary__item'));
    const savedTotal = totalSavings(viewState.goals);
    summary.children[1].append(node('span', tr(viewState, 'Épargne totale')), node('strong', money(savedTotal)));
    const createButton = iconActionButton(tr(viewState, 'Nouvelle épargne'), 'plus', () => { editingGoal = null; renderTypeChooser(); }, 'wide-primary savings-summary__action');
    createButton.setAttribute('aria-label', tr(viewState, 'Créer une épargne'));
    summary.append(createButton);
    const headingRow = node('div', undefined, 'section-heading-row');
    headingRow.append(node('h2', tr(viewState, 'Objectifs')));
    const goals = viewState.goals.filter(goal => goal.mode !== 'free');
    const freeSavings = viewState.goals.filter(goal => goal.mode === 'free');
    const list = node('div', undefined, 'goals-list');
    if (!goals.length) list.append(node('p', tr(viewState, 'Aucun objectif pour le moment.'), 'empty-copy'));
    goals.forEach(goal => list.append(goalCard(goal)));
    const freeHeading = node('div', undefined, 'section-heading-row');
    freeHeading.append(node('h2', tr(viewState, 'Épargne libre')));
    const freeList = node('div', undefined, 'goals-list');
    if (!freeSavings.length) freeList.append(node('p', tr(viewState, 'Aucune épargne libre pour le moment.'), 'empty-copy'));
    freeSavings.forEach(goal => freeList.append(goalCard(goal)));
    app.append(hero, summary, headingRow, list, freeHeading, freeList);
    heading.focus({ preventScroll: true });
  };

  const renderTypeChooser = () => {
    app.replaceChildren();
    const { hero, heading } = createHero(viewState, { title: tr(viewState, 'Nouvelle épargne'), route: 'savings', navigate });
    const choices = node('section', undefined, 'savings-type-choices');
    [['free', 'Épargne libre', 'moni_epargne_libre.png', 'Sans cible ni date.'], ['objective', 'Épargne par objectif', 'moni_epargne_objectif.png', 'Pour financer un projet précis.']].forEach(([mode, label, asset, description]) => {
      const button = actionButton('', () => { editorMode = mode; renderEditor(); }, 'savings-type-choice');
      const image = document.createElement('img'); image.src = `./public/assets/savings/${asset}`; image.alt = ''; image.addEventListener('error', () => image.remove(), { once: true });
      image.width = 112; image.height = 112; image.decoding = 'async';
      button.append(image, node('strong', tr(viewState, label)), node('small', tr(viewState, description))); choices.append(button);
    });
    app.append(hero, choices, actionButton(tr(viewState, 'Annuler'), renderList, 'secondary-wide'));
    heading.focus({ preventScroll: true });
  };

  const goalCard = goal => {
    const summary = savingsSummary(goal);
    const free = goal.mode === 'free';
    const article = node('article', undefined, 'goal-card');
    const top = node('div', undefined, 'goal-card__top');
    top.append(node('span', undefined, 'goal-card__icon'), node('div'));
    top.firstChild.append(icon('piggy-bank'));
    top.lastChild.append(node('h3', goal.name), node('p', free ? tr(viewState, 'Épargne libre') : fmt(viewState, 'Objectif : {target}', { target: money(goal.target) })));
    const edit = actionButton('', () => { editingGoal = goal; renderEditor(); }, 'row-chevron');
    edit.setAttribute('aria-label', tr(viewState, 'Modifier'));
    edit.append(icon('pencil'));
    top.append(edit);
    if (!free && goal.date) top.children[1].append(node('span', new Intl.DateTimeFormat(financeLocale(viewState), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${goal.date}T00:00:00Z`)), 'goal-card__date'));
    article.append(top);
    const progressRow = node('div', undefined, 'goal-card__progress-row'); progressRow.append(node('strong', free ? money(summary.saved) : `${summary.progress} %`), node('span', free ? tr(viewState, 'Versements libres') : `${money(summary.saved)} / ${money(goal.target)}`)); article.append(progressRow);
    if (!free) {
      const progress = node('div', undefined, 'visual-progress'); progress.style.setProperty('--progress', `${summary.progress}%`); progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-valuenow', String(summary.progress)); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100'); progress.setAttribute('aria-label', fmt(viewState, 'Progression de {name}', { name: goal.name })); article.append(progress);
    }
    const management = node('div', undefined, 'goal-management');
    management.className = 'goal-management';
    management.hidden = true;
    const actions = node('div', undefined, 'goal-card__actions');
    actions.append(actionButton(tr(viewState, 'Supprimer'), async () => { if (!window.confirm(fmt(viewState, 'Supprimer l’objectif « {name} » et ses contributions ?', { name: goal.name }))) return; try { if (!viewState.demoFixture) await deleteGoal(goal.id); viewState.goals.splice(viewState.goals.indexOf(goal), 1); renderList(); } catch (exception) { window.alert(tr(viewState, exception.message || 'Impossible de supprimer l’objectif.')); } }, 'row-action'));
    management.append(actions);
    const contributionForm = node('form', undefined, 'contribution-form');
    const contribution = field(contributionForm, fmt(viewState, 'Ajouter une contribution ({currency})', { currency: viewState.currency }), 'text'); contribution.inputMode = 'decimal'; contribution.setAttribute('aria-label', fmt(viewState, 'Ajouter une contribution ({currency})', { currency: viewState.currency }));
    const contributionError = node('p', undefined, 'form-error'); contributionError.setAttribute('role', 'alert');
    const addContribution = actionButton(tr(viewState, 'Ajouter'), null, 'secondary-wide'); addContribution.type = 'submit';
    contributionForm.append(contributionError, addContribution);
    contributionForm.addEventListener('submit', async event => { event.preventDefault(); try { const value = amount(contribution.value, viewState.currency); if (!viewState.demoFixture) { const result = await saveContribution({ goalId: goal.id, amount: value }); applyServerState(viewState, result.state); } else { const entry = { id: crypto.randomUUID(), amount: value }; const updated = { ...goal, contributions: [...goal.contributions, entry] }; totalSavings(viewState.goals.map(item => item === goal ? updated : item)); goal.contributions.push(entry); } renderList(); } catch (exception) { contributionError.textContent = tr(viewState, exception.message); } });
    management.append(contributionForm);
    const contribute = actionButton(tr(viewState, 'Verser'), () => { management.hidden = !management.hidden; if (!management.hidden) contribution.focus({ preventScroll: true }); }, 'row-action goal-contribute');
    article.append(contribute);
    if (goal.contributions.length) {
      const entries = node('ul', undefined, 'contribution-list');
      goal.contributions.forEach(entry => { const item = node('li'); item.append(node('span', money(entry.amount)), actionButton(tr(viewState, 'Corriger'), async () => { const raw = prompt(tr(viewState, 'Montant corrigé'), inputAmount(entry.amount, viewState.currency)); if (raw === null) return; try { const value = amount(raw, viewState.currency); if (!viewState.demoFixture) { const result = await saveContribution({ id: entry.id, goalId: goal.id, amount: value }); applyServerState(viewState, result.state); } else entry.amount = value; renderList(); } catch (exception) { alert(tr(viewState, exception.message)); } }, 'row-action'), actionButton(tr(viewState, 'Annuler'), async () => { if (confirm(tr(viewState, 'Annuler cette contribution ?'))) { try { if (!viewState.demoFixture) await deleteContribution(goal.id, entry.id); goal.contributions.splice(goal.contributions.indexOf(entry), 1); renderList(); } catch (exception) { alert(tr(viewState, exception.message)); } } }, 'row-action')); entries.append(item); });
      management.append(entries);
    }
    article.append(management);
    return article;
  };

  const renderEditor = () => {
    app.replaceChildren();
    const goalMode = editingGoal ? (editingGoal.mode === 'free' ? 'free' : 'objective') : editorMode;
    const free = goalMode === 'free';
    const titleText = editingGoal ? tr(viewState, free ? 'Modifier l’épargne libre' : 'Modifier l’objectif') : tr(viewState, free ? 'Nouvelle épargne libre' : 'Nouvel objectif d’épargne');
    const subtitle = tr(viewState, free ? 'Épargne à ton rythme, sans objectif imposé.' : 'Épargne pour réaliser un projet précis.');
    const { hero, heading } = createHero(viewState, { title: titleText, subtitle, route: 'goal-edit', navigate, back: true });
    const form = node('form', undefined, 'visual-card visual-form goal-editor'); form.noValidate = true;
    form.dataset.savingsMode = goalMode;
    const banner = node('div', undefined, 'savings-editor-banner');
    const illustration = document.createElement('img');
    illustration.src = `./public/assets/savings/${free ? 'moni_epargne_libre.png' : 'moni_epargne_objectif.png'}`;
    illustration.addEventListener('error', () => illustration.remove(), { once: true });
    illustration.alt = '';
    illustration.width = 96;
    illustration.height = 96;
    illustration.decoding = 'async';
    banner.append(illustration, node('div'));
    banner.lastChild.append(node('strong', tr(viewState, free ? 'Épargne libre' : 'Objectif d’épargne')), node('p', tr(viewState, free ? 'Mets de côté à ton rythme, sans cible ni date.' : 'Définis ton projet et le montant à atteindre. La date cible est facultative.')));
    form.append(banner);
    const demoDefaults = viewState.demoFixture && !editingGoal ? (free ? { name: 'Épargne libre', initial: 25000 } : { name: 'Ordinateur portable', target: 120000, initial: 30000, date: '2027-06-01' }) : null;
    const name = field(form, tr(viewState, free ? 'Nom de l’épargne' : 'Nom de l’objectif'), 'text', editingGoal?.name || demoDefaults?.name || '', free ? 'piggy-bank' : 'target'); name.maxLength = 80; name.setAttribute('aria-label', tr(viewState, free ? 'Nom de l’épargne' : 'Nom de l’objectif')); name.required = !free;
    const target = free ? null : field(form, tr(viewState, 'Montant cible'), 'text', editingGoal?.target ? inputAmount(editingGoal.target, viewState.currency) : demoDefaults ? inputAmount(demoDefaults.target, viewState.currency) : '', 'coins', viewState.currency);
    if (target) { target.inputMode = 'decimal'; target.required = true; target.setAttribute('aria-label', fmt(viewState, 'Montant cible ({currency})', { currency: viewState.currency })); }
    let initial;
    if (!editingGoal) { initial = field(form, tr(viewState, 'Montant initial (facultatif)'), 'text', demoDefaults ? inputAmount(demoDefaults.initial, viewState.currency) : '', 'wallet-cards', viewState.currency); initial.inputMode = 'decimal'; initial.setAttribute('aria-label', fmt(viewState, 'Montant initial ({currency})', { currency: viewState.currency })); }
    [target, initial].filter(Boolean).forEach(input => {
      const format = () => { try { input.value = formatAmount(amount(input.value, viewState.currency, true), viewState.currency); } catch {} };
      input.addEventListener('blur', format);
      if (input.value) format();
    });
    const date = free ? null : field(form, tr(viewState, 'Date cible (facultative)'), 'date', editingGoal?.date || demoDefaults?.date || '');
    if (date) date.setAttribute('aria-label', tr(viewState, 'Date cible facultative'));
    const freeNote = free ? card('free-savings-note') : null;
    if (freeNote) freeNote.append(icon('info'), node('p', tr(viewState, 'Tu peux commencer avec un montant, ou l’ajouter plus tard.')));
    const progressPreview = free ? null : card('goal-progress-preview');
    const progressLabel = free ? null : node('strong', tr(viewState, 'Progression (aperçu)'));
    const progressPercent = free ? null : node('strong', '0 %', 'goal-progress-preview__percent');
    const progressBar = free ? null : node('div', undefined, 'visual-progress');
    const progressCopy = free ? null : node('p', undefined, 'goal-progress-preview__copy');
    if (progressPreview) {
      const progressHeader = node('div', undefined, 'goal-progress-preview__header'); progressHeader.append(progressLabel, progressPercent);
      progressBar.setAttribute('role', 'progressbar'); progressBar.setAttribute('aria-label', tr(viewState, 'Progression de l’objectif')); progressBar.setAttribute('aria-valuemin', '0'); progressBar.setAttribute('aria-valuemax', '100');
      progressPreview.append(progressHeader, progressBar, progressCopy);
    }
    const updateProgress = () => {
      if (free) return;
      try {
        const targetAmount = amount(target.value, viewState.currency);
        const starting = editingGoal ? totalSavings([editingGoal]) : (initial.value.trim() ? amount(initial.value, viewState.currency, true) : 0);
        const percent = Math.min(100, Math.round((starting / targetAmount) * 100));
        const left = Math.max(0, targetAmount - starting);
        progressPercent.textContent = `${percent} %`;
        progressBar.style.setProperty('--progress', `${percent}%`);
        progressBar.setAttribute('aria-valuenow', String(percent));
        progressCopy.textContent = starting > targetAmount
          ? fmt(viewState, '{saved} épargnés · objectif dépassé de {amount}', { saved: money(starting), amount: money(starting - targetAmount) })
          : fmt(viewState, '{saved} épargnés · {remaining} restants', { saved: money(starting), remaining: money(left) });
      } catch {
        progressPercent.textContent = '—';
        progressBar.style.setProperty('--progress', '0%');
        progressBar.setAttribute('aria-valuenow', '0');
        progressCopy.textContent = tr(viewState, 'Renseigne un montant cible valide pour afficher la progression.');
      }
    };
    if (progressPreview) form.addEventListener('input', updateProgress);
    updateProgress();
    const error = node('p', undefined, 'form-error'); error.setAttribute('role', 'alert');
    const save = actionButton(editingGoal ? tr(viewState, 'Enregistrer') : tr(viewState, free ? 'Créer l’épargne' : 'Créer l’objectif'), null, 'wide-primary'); save.type = 'submit';
    if (progressPreview) form.append(progressPreview);
    if (freeNote) form.append(freeNote);
    form.append(error, save, actionButton(tr(viewState, 'Annuler'), renderList, 'secondary-wide'));
    form.addEventListener('submit', async event => { event.preventDefault(); try { const trimmed = name.value.trim() || (free ? tr(viewState, 'Épargne libre') : ''); if (!trimmed || trimmed.length > 80) throw new Error(tr(viewState, 'Indique un nom valide.')); const starting = !editingGoal && initial.value.trim() ? amount(initial.value, viewState.currency, true) : 0; const targetAmount = free ? null : amount(target.value, viewState.currency); if (!free && date.value && !validDate(date.value)) throw new Error(tr(viewState, 'Indique une date valide.')); if (!free && !editingGoal && date.value && date.value < localDate()) throw new Error(tr(viewState, 'Choisis une date future ou aujourd’hui.')); if (!viewState.demoFixture) { const payload = { name: trimmed, mode: free ? 'free' : 'goal', target: targetAmount, date: free ? null : (date.value || null) }; if (!editingGoal) payload.initial = starting; const result = editingGoal ? await updateGoal(editingGoal.id, payload) : await createGoal(payload); applyServerState(viewState, result.state); } else { const contributions = editingGoal ? editingGoal.contributions : (starting ? [{ id: crypto.randomUUID(), amount: starting }] : []); const updated = { id: editingGoal?.id || crypto.randomUUID(), mode: free ? 'free' : 'goal', name: trimmed, target: targetAmount, date: free ? null : (date.value || null), contributions }; totalSavings([...viewState.goals.filter(item => item !== editingGoal), updated]); if (editingGoal) viewState.goals.splice(viewState.goals.indexOf(editingGoal), 1, updated); else viewState.goals.push(updated); } renderList(); } catch (exception) { error.textContent = tr(viewState, exception.message); }});
    app.append(hero, form); heading.focus({ preventScroll: true });
  };

  if (route === 'goal-edit') renderEditor();
  else renderList();
}
