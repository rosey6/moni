import { financeText as tr, financeLocale } from '../app/i18nFinance.js?v=full-i18n-savingsfix-20261122';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../app/api.js';
import { actionButton, createHero, icon, iconButton } from '../components/financeUi.js';

const destinations = new Set(['dashboard', 'budgets', 'subscriptions-manage', 'savings', 'profile', 'notifications']);
const icons = { budget: 'chart-pie', subscription: 'calendar-days', savings: 'piggy-bank', monthly: 'chart-no-axes-column-increasing', security: 'shield-check' };

export function createNotificationsPage(app, state, navigate) {
  app.replaceChildren();
  const { hero, heading } = createHero(state, { title: tr(state, 'Notifications'), route: 'notifications', navigate });
  const markAll = iconButton(tr(state, 'Tout marquer comme lu'), 'check-double', () => mark(null), 'notifications-mark-all');
  hero.append(markAll);
  const filters = document.createElement('div'); filters.className = 'notifications-filters';
  const all = actionButton(tr(state, 'Toutes'), () => { unreadOnly = false; load(); });
  const unread = actionButton(tr(state, 'Non lues'), () => { unreadOnly = true; load(); });
  filters.append(all, unread);
  const status = document.createElement('p'); status.className = 'notifications-status'; status.setAttribute('role', 'status');
  const list = document.createElement('section'); list.className = 'notifications-list'; list.setAttribute('aria-label', tr(state, 'Historique des notifications'));
  const more = actionButton(tr(state, 'Afficher plus'), () => load(true), 'secondary-wide'); more.hidden = true;
  app.append(hero, filters, status, list, more);
  let items = [], unreadOnly = false, busy = false, nextCursor = null, unreadCount = 0, requestId = 0;
  const publish = result => { if (app.isConnected) window.dispatchEvent(new CustomEvent('moni:notifications-updated', { detail: result })); };
  const dateGroup = value => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.valueOf())) return tr(state, 'Historique');
    const now = new Date(), current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (day.valueOf() === current.valueOf()) return tr(state, 'Aujourd’hui');
    const yesterday = new Date(current); yesterday.setDate(current.getDate() - 1);
    if (day.valueOf() === yesterday.valueOf()) return tr(state, 'Hier');
    return new Intl.DateTimeFormat(financeLocale(state), { dateStyle: 'long' }).format(date);
  };
  const draw = () => {
    all.setAttribute('aria-pressed', String(!unreadOnly)); unread.setAttribute('aria-pressed', String(unreadOnly));
    unread.textContent = unreadCount ? `${tr(state, 'Non lues')} (${unreadCount})` : tr(state, 'Non lues');
    markAll.disabled = busy || !unreadCount;
    more.hidden = !nextCursor; more.disabled = busy;
    list.replaceChildren();
    if (!items.length) { const empty = document.createElement('p'); empty.className = 'notifications-empty'; empty.textContent = tr(state, unreadOnly ? 'Aucune notification non lue.' : 'Aucune notification actuellement.'); list.append(empty); }
    let groupName, group;
    items.forEach(item => {
      const title = dateGroup(item.createdAt);
      if (title !== groupName) {
        groupName = title;
        const heading = document.createElement('h2'); heading.className = 'notification-group-title'; heading.textContent = title;
        group = document.createElement('div'); group.className = 'notification-group';
        list.append(heading, group);
      }
      const row = document.createElement('button'); row.type = 'button'; row.className = `notification-item${item.type === 'budget' ? ' notification-item--budget' : ''}`;
      row.disabled = busy;
      const titleText = typeof item.title === 'string' && item.title.trim() ? item.title : tr(state, 'Notification');
      const messageText = typeof item.text === 'string' ? item.text : '';
      const leading = icon(icons[item.type] || 'bell', 'notification-item__icon');
      const content = document.createElement('div'); content.className = 'notification-item__content';
      const titleNode = document.createElement('strong'); titleNode.className = 'notification-item__title'; titleNode.textContent = titleText;
      const text = document.createElement('span'); text.className = 'notification-item__message'; text.textContent = messageText;
      content.append(titleNode, text);
      if (item.createdAt && !Number.isNaN(new Date(item.createdAt).valueOf())) {
        const time = document.createElement('time'); time.dateTime = item.createdAt;
        time.textContent = new Intl.DateTimeFormat(financeLocale(state), { hour: '2-digit', minute: '2-digit' }).format(new Date(item.createdAt));
        content.append(time);
      }
      const dot = document.createElement('span'); dot.className = 'notification-item__dot'; dot.hidden = item.read; dot.setAttribute('aria-hidden', 'true');
      const stateText = tr(state, item.read ? 'Lue' : 'Non lue');
      row.setAttribute('aria-label', `${titleText}. ${messageText}. ${stateText}`);
      row.append(leading, content, dot);
      row.addEventListener('click', async () => {
        if (busy) return;
        if (!item.read && !(await mark(item))) return;
        if (destinations.has(item.destination)) navigate(item.destination);
      });
      group.append(row);
    });
  };
  async function mark(item) {
    if (busy) return false;
    busy = true; status.textContent = ''; draw();
    try {
      const result = item ? await markNotificationRead(item.id) : await markAllNotificationsRead();
      publish(result);
      busy = false;
      await load();
      return true;
    } catch {
      status.textContent = tr(state, 'Impossible de marquer les notifications comme lues. Réessaie.');
      return false;
    } finally { busy = false; draw(); }
  }
  async function load(append = false) {
    const token = ++requestId;
    status.textContent = tr(state, 'Chargement des notifications…');
    if (!append) { items = []; nextCursor = null; list.replaceChildren(); }
    more.disabled = true;
    try {
      const result = state.demoFixture ? { notifications: [], unreadCount: 0 } : await listNotifications({ filter: unreadOnly ? 'unread' : 'all', limit: 30, ...(append && nextCursor ? { cursor: nextCursor } : {}) });
      if (token !== requestId || !app.isConnected) return;
      const received = result.notifications || [];
      items = append ? [...items, ...received] : received;
      nextCursor = result.nextCursor || null;
      unreadCount = Number.isSafeInteger(result.unreadCount) ? result.unreadCount : items.filter(item => !item.read).length;
      status.textContent = ''; draw(); publish(result);
    } catch {
      if (token !== requestId || !app.isConnected) return;
      status.textContent = tr(state, 'Impossible de charger les notifications.');
      const retry = actionButton(tr(state, 'Réessayer'), () => load(append), 'secondary-wide'); list.replaceChildren(retry);
    }
  }
  heading.focus({ preventScroll: true });
  load();
}
