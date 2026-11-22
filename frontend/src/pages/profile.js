import { switchCurrency } from '../app/financeState.js';
import { t } from '../app/i18n.js';
import { financeText as financeTr } from '../app/i18nFinance.js?v=full-i18n-savingsfix-20261122';
import { actionButton, card, createHero, icon, iconActionButton, iconButton } from '../components/financeUi.js';
import { getPushStatus, revokePushDevice, saveProfile, sendPushTest } from '../app/api.js';
import { applyServerState } from '../app/serverState.js';
import { FRONTEND_VERSION, isIOSWebApp, preparePushActivation, pushApplicationServerKey, registerPreparedPushSubscription } from '../app/pushActivation.js';

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function ensureProfileStyles() {
  if (document.querySelector('link[data-profile-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './src/styles/profile.css';
  link.dataset.profileStyles = 'true';
  document.head.append(link);
}

function settingsSection(title, iconName, content) {
  const wrapper = node('section', undefined, 'settings-section');
  const heading = node('h2', title, 'settings-section__title');
  heading.prepend(icon(iconName));
  wrapper.append(heading, content);
  return wrapper;
}

function profileMenuRow(label, subtitle, iconName, action, accessibleLabel = label) {
  const row = node('article', undefined, 'profile-menu-row');
  const rowIcon = node('span', undefined, 'profile-menu-row__icon');
  rowIcon.append(icon(iconName));
  const copy = node('div');
  copy.append(node('strong', label), node('span', subtitle));
  row.append(rowIcon, copy);
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-menu-row__button';
    button.setAttribute('aria-label', accessibleLabel);
    button.append(icon('chevron-right'));
    button.addEventListener('click', action);
    row.append(button);
  } else row.append(icon('chevron-right', 'profile-menu-row__chevron'));
  return row;
}

function initials(name) {
  return (name || 'Mon compte').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase()).join('') || 'M';
}

function createProfileForm(state, identityCopy, identityAvatar) {
  const edit = document.createElement('dialog');
  edit.className = 'visual-card profile-edit';
  edit.setAttribute('aria-labelledby', 'profile-edit-title');
  const form = node('form', undefined, 'profile-form');
  const title = node('h2', financeTr(state, 'Modifier le profil'));
  title.id = 'profile-edit-title';
  const avatar = node('span', undefined, 'profile-edit__avatar');
  avatar.textContent = initials(state.profile.name);
  const nameLabel = node('label', undefined, 'visual-field');
  nameLabel.append(node('span', t(state, 'name'), 'visual-field__label'));
  const name = document.createElement('input');
  name.value = state.profile.name;
  name.maxLength = 80;
  name.required = true;
  name.setAttribute('aria-label', t(state, 'name'));
  nameLabel.append(node('span', undefined, 'visual-field__control'));
  nameLabel.lastChild.append(name);

  const emailLabel = node('label', undefined, 'visual-field');
  emailLabel.append(node('span', t(state, 'email'), 'visual-field__label'));
  const email = document.createElement('input');
  email.type = 'email';
  email.value = state.profile.email;
  email.maxLength = 254;
  email.setAttribute('aria-label', t(state, 'email'));
  emailLabel.append(node('span', undefined, 'visual-field__control'));
  emailLabel.lastChild.append(email);

  const save = actionButton(financeTr(state, 'Enregistrer'), null, 'wide-primary');
  save.type = 'submit';
  const status = node('p', undefined, 'form-status');
  status.setAttribute('role', 'status');
  const cancel = actionButton(financeTr(state, 'Annuler'), () => edit.close(), 'secondary-wide');
  const header = node('div', undefined, 'profile-dialog-header');
  header.append(title, iconButton(financeTr(state, 'Fermer'), 'x', () => edit.close()));
  const actions = node('div', undefined, 'profile-dialog-actions');
  actions.append(cancel, save);
  form.append(header, avatar, nameLabel, emailLabel, status, actions);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!name.value.trim()) {
      status.textContent = t(state, 'missing');
      name.focus();
      return;
    }
    if (!email.value.trim() || !email.validity.valid) {
      status.textContent = t(state, 'email');
      email.focus();
      return;
    }
    const previous = { ...state.profile };
    state.profile = { ...state.profile, name: name.value.trim(), email: email.value.trim() };
    save.disabled = true;
    try {
      if (state.demoFixture) {
        status.textContent = t(state, 'saved');
        identityCopy.firstChild.textContent = state.profile.name;
        identityCopy.children[1].textContent = state.profile.email;
        identityAvatar.textContent = avatar.textContent = initials(state.profile.name);
        edit.close();
        return;
      }
      const result = await saveProfile({ name: state.profile.name, email: state.profile.email });
      applyServerState(state, result.state);
      status.textContent = t(state, 'saved');
      identityCopy.firstChild.textContent = state.profile.name;
      identityCopy.children[1].textContent = state.profile.email;
      identityAvatar.textContent = avatar.textContent = initials(state.profile.name);
      edit.close();
    } catch (exception) {
      state.profile = previous;
      status.textContent = financeTr(state, exception.message || 'Impossible d’enregistrer le profil.');
    } finally { save.disabled = false; }
  });
  edit.append(form);
  return { edit, name };
}

export function createProfilePage(app, state, navigate) {
  ensureProfileStyles();
  const route = location.hash.slice(1).split('?')[0];
  app.replaceChildren();
  if (route === 'privacy') {
    const { hero, heading } = createHero(state, { title: financeTr(state, 'Sécurité et confidentialité'), route: 'privacy', navigate, back: true, backRoute: 'profile' });
    const security = card('privacy-section');
    security.append(node('h2', financeTr(state, 'Sécurité')), profileMenuRow(financeTr(state, 'Mot de passe'), financeTr(state, 'Demande un lien de réinitialisation envoyé par e-mail.'), 'lock-keyhole', () => navigate('forgot-password'), financeTr(state, 'Réinitialiser mon mot de passe')));
    const privacy = card('privacy-section');
    privacy.append(node('h2', financeTr(state, 'Confidentialité')), node('p', financeTr(state, 'La politique de confidentialité détaillée doit encore être publiée.'), 'privacy-policy-notice'));
    const data = card('privacy-section');
    data.append(node('h2', financeTr(state, 'Données personnelles')), node('p', financeTr(state, 'Tes données financières sont chargées depuis ton compte Moni.')));
    app.append(hero, security, privacy, data);
    heading.focus({ preventScroll: true });
    return;
  }
  if (route === 'settings') {
    renderSettings(app, state, navigate);
    return;
  }

  const { hero, heading } = createHero(state, { title: t(state, 'profile'), route: 'profile', navigate });
  const identity = card('profile-identity');
  const avatar = node('span', undefined, 'profile-avatar');
  avatar.textContent = initials(state.profile.name);
  const identityCopy = node('div');
  identityCopy.append(
    node('strong', state.profile.name || financeTr(state, 'Mon compte')),
    node('span', state.profile.email || financeTr(state, 'Adresse non renseignée'))
  );
  const editButton = iconButton(financeTr(state, 'Modifier'), 'pencil', undefined, 'profile-identity__edit');
  const { edit, name } = createProfileForm(state, identityCopy, avatar);
  const openEdit = () => { edit.showModal(); name.focus(); };
  editButton.addEventListener('click', openEdit);
  identity.append(avatar, identityCopy, editButton);

  const menu = card('profile-menu');
  const about = document.createElement('dialog');
  about.className = 'visual-card profile-confirm';
  about.setAttribute('aria-labelledby', 'profile-about-title');
  const aboutTitle = node('h2', financeTr(state, 'À propos de Moni')); aboutTitle.id = 'profile-about-title';
  about.append(aboutTitle, node('p', financeTr(state, 'Moni permet de suivre ton budget, tes transactions et ton épargne.')), actionButton(financeTr(state, 'Fermer'), () => about.close(), 'secondary-wide'));
  menu.append(
    profileMenuRow(financeTr(state, 'Paramètres'), financeTr(state, 'Langue, devise et notifications'), 'settings', () => navigate('settings')),
    profileMenuRow(financeTr(state, 'Abonnements'), financeTr(state, 'Services et montants mensuels'), 'calendar', () => navigate('subscriptions-manage')),
    profileMenuRow(financeTr(state, 'Sécurité et confidentialité'), financeTr(state, 'Session et protection des données'), 'lock-keyhole', () => navigate('privacy')),
    profileMenuRow(financeTr(state, 'À propos'), financeTr(state, 'Informations sur Moni'), 'info', () => about.showModal())
  );
  const confirmLogout = document.createElement('dialog');
  confirmLogout.className = 'visual-card profile-confirm';
  confirmLogout.setAttribute('aria-labelledby', 'logout-title');
  const logoutTitle = node('h2', financeTr(state, 'Se déconnecter de Moni ?')); logoutTitle.id = 'logout-title';
  const logoutActions = node('div', undefined, 'profile-dialog-actions');
  logoutActions.append(actionButton(financeTr(state, 'Annuler'), () => confirmLogout.close(), 'secondary-wide'), actionButton(financeTr(state, 'Se déconnecter'), () => { confirmLogout.close(); navigate('logout'); }, 'logout-confirm-button'));
  confirmLogout.append(logoutTitle, node('p', financeTr(state, 'Tu devras te reconnecter pour accéder à ton compte.')), logoutActions);
  const logout = iconActionButton(financeTr(state, 'Se déconnecter'), 'log-out', () => confirmLogout.showModal(), 'logout-button');
  app.append(hero, identity, edit, menu, logout, about, confirmLogout);
  heading.focus({ preventScroll: true });
}

function settingRow(iconName, label, description, control, className = '') {
  const row = node('label', undefined, `settings-row ${className}`.trim());
  const leading = node('span', undefined, 'settings-row__icon');
  leading.append(icon(iconName));
  const copy = node('span', undefined, 'settings-row__copy');
  copy.append(node('strong', label), node('small', description));
  row.append(leading, copy, control);
  return row;
}

function renderSettings(app, state, navigate) {
  const { hero, heading } = createHero(state, { title: t(state, 'settings'), route: 'settings', navigate, back: true, backRoute: 'profile' });
  const status = node('p', undefined, 'settings-status');
  status.setAttribute('role', 'status');

  const language = document.createElement('select');
  language.setAttribute('aria-label', t(state, 'language'));
  [['fr', 'Français'], ['en', 'English']].forEach(([value, label]) => {
    const option = node('option', label);
    option.value = value;
    language.append(option);
  });
  language.value = state.preferences.language;
  language.addEventListener('change', async () => {
    const previous = state.preferences.language;
    state.preferences.language = language.value;
    if (state.demoFixture) { navigate('settings'); return; }
    try { const result = await saveProfile({ language: language.value }); applyServerState(state, result.state); navigate('settings'); }
    catch (error) { state.preferences.language = previous; language.value = previous; status.textContent = financeTr(state, error.message || 'Impossible d’enregistrer la langue.'); }
  });

  const currency = document.createElement('select');
  currency.setAttribute('aria-label', t(state, 'currency'));
  [...new Set([state.currency, 'XOF', 'MAD', 'EUR', 'USD'])].forEach(code => {
    const option = node('option', code === 'XOF' ? 'XOF (FCFA)' : code);
    option.value = code;
    currency.append(option);
  });
  currency.value = state.currency;
  currency.addEventListener('change', async () => {
    if (confirm(t(state, 'currencyConfirm'))) {
      const previous = state.currency;
      switchCurrency(state, currency.value);
      if (state.demoFixture) { navigate('settings'); return; }
      try { const result = await saveProfile({ currency: currency.value }); applyServerState(state, result.state); navigate('settings'); }
      catch (error) { switchCurrency(state, previous); currency.value = previous; status.textContent = financeTr(state, error.message || 'Impossible de modifier la devise.'); }
    } else currency.value = state.currency;
  });

  const general = card('settings-card');
  general.append(
    settingRow('globe', t(state, 'language'), financeTr(state, 'Choisis la langue de l’application.'), language, 'settings-row--language'),
    settingRow('coins', t(state, 'currency'), financeTr(state, 'Définis ta devise principale.'), currency, 'settings-row--currency')
  );

  const alerts = card('settings-card settings-card--alerts');
  const label = node('label', undefined, 'switch-row settings-global-alert');
  const copy = node('span', undefined, 'settings-global-alert__copy');
  const description = node('small');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('aria-label', financeTr(state, 'Notifications'));
  description.id = 'settings-notifications-description';
  input.setAttribute('aria-describedby', description.id);
  const keys = ['budget', 'subscriptions', 'savings'];
  let prepared = null, serverStatus = null, lastActivationError = '', activationPending = false;
  const sync = () => {
    const enabled = keys.filter(key => state.preferences.alerts[key]).length;
    input.checked = activationPending || (enabled === keys.length && (state.demoFixture || Boolean(serverStatus?.currentDevice)));
    input.indeterminate = enabled > 0 && enabled < keys.length;
    description.textContent = financeTr(state, input.indeterminate ? 'Certaines alertes sont activées.' : input.checked ? 'Alertes du compte et notifications sur cet appareil.' : 'Activer les alertes du compte et sur cet appareil.');
  };
  input.disabled = !state.demoFixture;
  sync();
  input.addEventListener('change', () => {
    const previous = { ...state.preferences.alerts };
    if (!input.checked) {
      keys.forEach(key => { state.preferences.alerts[key] = false; });
      if (state.demoFixture) { sync(); return; }
      input.disabled = true;
      (async () => {
        let preferencesSaved = false;
        try {
          const result = await saveProfile({ alerts: state.preferences.alerts });
          applyServerState(state, result.state);
          preferencesSaved = true;
          if (serverStatus?.currentDevice) {
            await revokePushDevice(serverStatus.currentDevice);
            const subscription = prepared?.subscription || await prepared?.registration?.pushManager.getSubscription();
            if (subscription) await subscription.unsubscribe();
          }
          await refreshPush();
          status.textContent = '';
          pushStatus.textContent = financeTr(state, 'Notifications désactivées sur cet appareil.');
        } catch (error) {
          if (!preferencesSaved) Object.assign(state.preferences.alerts, previous);
          status.textContent = financeTr(state, error.message || 'Impossible de désactiver les notifications.');
          pushStatus.textContent = status.textContent;
          await refreshPush().catch(() => {});
        } finally { sync(); input.disabled = false; }
      })();
      sync();
      return;
    }
    if (state.demoFixture) { keys.forEach(key => { state.preferences.alerts[key] = true; }); sync(); return; }
    if (!prepared?.registration || !prepared.config?.enabled || !prepared.config?.publicKey) {
      input.checked = false;
      pushStatus.textContent = financeTr(state, prepared?.error || 'Configuration VAPID ou Service Worker indisponible. Recharge la page.');
      return;
    }
    if (!('Notification' in window) || !('PushManager' in window)) {
      input.checked = false;
      pushStatus.textContent = financeTr(state, 'Notifications incompatibles avec cet appareil ou ce contexte.');
      return;
    }
    if (Notification.permission === 'denied') {
      input.checked = false;
      pushStatus.textContent = financeTr(state, 'Autorisation refusée. Modifie-la dans les réglages iOS pour continuer.');
      return;
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios && !isIOSWebApp()) {
      input.checked = false;
      pushStatus.textContent = financeTr(state, 'Ajoute Moni à l’écran d’accueil, puis ouvre-la depuis son icône.');
      return;
    }
    let created = false, subscriptionPromise;
    try {
      subscriptionPromise = prepared.subscription
        ? Promise.resolve(prepared.subscription)
        : prepared.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushApplicationServerKey(prepared.config.publicKey) });
      created = !prepared.subscription;
    } catch (error) {
      input.checked = false;
      lastActivationError = `${error.name || 'Erreur'}: ${error.message || 'Échec de PushManager.subscribe().'}`;
      pushStatus.textContent = lastActivationError;
      updateDiagnostics();
      return;
    }
    activationPending = true;
    input.disabled = true;
    keys.forEach(key => { state.preferences.alerts[key] = true; });
    sync();
    (async () => {
      let serverRegistered = false;
      try {
        const subscription = await subscriptionPromise;
        await registerPreparedPushSubscription(subscription);
        serverRegistered = true;
        const result = await saveProfile({ alerts: state.preferences.alerts });
        applyServerState(state, result.state);
        lastActivationError = '';
        await refreshPush();
        pushStatus.textContent = financeTr(state, 'Notifications push et alertes internes activées.');
        status.textContent = '';
      } catch (error) {
        Object.assign(state.preferences.alerts, previous);
        if (created && !serverRegistered) {
          const subscription = await subscriptionPromise.catch(() => null);
          if (subscription) await subscription.unsubscribe().catch(() => {});
        }
        lastActivationError = `${error.name || 'Erreur'}: ${error.message || 'Erreur d’activation ou du serveur.'}`;
        pushStatus.textContent = serverRegistered
          ? `${financeTr(state, 'Push activé, mais les alertes internes n’ont pas été enregistrées :')} ${lastActivationError}`
          : error.status ? `${financeTr(state, 'Erreur serveur lors de l’enregistrement :')} ${lastActivationError}` : `${financeTr(state, 'Erreur d’activation :')} ${lastActivationError}`;
        await refreshPush().catch(() => {});
        updateDiagnostics();
      } finally { activationPending = false; sync(); input.disabled = false; }
    })();
  });
  copy.append(node('strong', financeTr(state, 'Notifications')), description);
  label.append(copy, input);
  alerts.append(label);
  const individualAlerts = node('div', undefined, 'profile-alert-options');
  for (const [key, title] of [['subscriptions', 'Rappels d’abonnements'], ['budget', 'Alertes de budget'], ['savings', 'Alertes d’épargne']]) {
    const option = node('label', undefined, 'switch-row');
    const optionCopy = node('span', undefined, 'settings-global-alert__copy');
    optionCopy.append(node('strong', financeTr(state, title)));
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = Boolean(state.preferences.alerts[key]);
    checkbox.setAttribute('aria-label', financeTr(state, title));
    checkbox.addEventListener('change', async () => {
      const previous = state.preferences.alerts[key];
      state.preferences.alerts[key] = checkbox.checked;
      checkbox.disabled = true; sync();
      try { const result = await saveProfile({ alerts: state.preferences.alerts }); applyServerState(state, result.state); }
      catch (error) { state.preferences.alerts[key] = previous; checkbox.checked = previous; status.textContent = financeTr(state, error.message || 'Impossible d’enregistrer les alertes.'); }
      finally { sync(); checkbox.disabled = false; }
    });
    option.append(optionCopy, checkbox); individualAlerts.append(option);
  }
  alerts.append(individualAlerts);
  alerts.append(node('p', financeTr(state, 'Le bouton Notifications active ou désactive les alertes du compte et les notifications sur cet appareil.')));
  const pushActions = node('div', undefined, 'profile-push-actions');
  const pushStatus = node('p', financeTr(state, 'Préparation des notifications sur cet appareil…'));
  pushStatus.setAttribute('role', 'status');
  const diagnostic = node('dl', undefined, 'profile-push-diagnostics');
  const diagnosticRows = new Map();
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    const title = node('dt', financeTr(state, 'Diagnostic temporaire iPhone'));
    const empty = node('dd', '');
    diagnostic.append(title, empty);
    for (const label of ['Version du frontend', 'Contexte sécurisé', 'Mode autonome', 'Notification.permission', 'PushManager disponible', 'Service Worker actif', 'Configuration VAPID disponible', 'Dernière erreur d’activation']) {
      const term = node('dt', financeTr(state, label)), value = node('dd', '—');
      diagnosticRows.set(label, value); diagnostic.append(term, value);
    }
  }
  const updateDiagnostics = () => {
    const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const values = {
      'Version du frontend': FRONTEND_VERSION,
      'Contexte sécurisé': String(window.isSecureContext),
      'Mode autonome': String(standalone),
      'Notification.permission': 'Notification' in window ? Notification.permission : 'incompatible',
      'PushManager disponible': String('PushManager' in window),
      'Service Worker actif': String(Boolean(prepared?.registration?.active)),
      'Configuration VAPID disponible': String(Boolean(prepared?.config?.enabled && prepared?.config?.publicKey)),
      'Dernière erreur d’activation': lastActivationError || 'Aucune'
    };
    for (const [key, value] of diagnosticRows) value.textContent = values[key];
  };
  const refreshPush = async () => {
    [prepared, serverStatus] = await Promise.all([preparePushActivation(), getPushStatus()]);
    const permission = 'Notification' in window ? Notification.permission : 'unsupported';
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    input.disabled = activationPending || (!state.demoFixture && !serverStatus.currentDevice && (!serverStatus.enabled || !prepared.config?.enabled || !prepared.config?.publicKey || !prepared.registration || permission === 'denied' || (ios && !isIOSWebApp())));
    sync();
    testButton.disabled = !serverStatus.currentDevice;
    if (serverStatus.currentDevice) pushStatus.textContent = financeTr(state, 'Notifications activées sur cet appareil.');
    else if (permission === 'denied') pushStatus.textContent = financeTr(state, 'Autorisation refusée. Modifie-la dans les réglages iOS pour continuer.');
    else if (permission === 'unsupported') pushStatus.textContent = prepared.error;
    else if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !isIOSWebApp()) pushStatus.textContent = financeTr(state, 'Ajoute Moni à l’écran d’accueil, puis ouvre-la depuis son icône.');
    else if (permission === 'default' && serverStatus.enabled && prepared.config?.enabled && prepared.registration) pushStatus.textContent = financeTr(state, 'Prêt : touche Notifications pour activer les alertes sur cet appareil.');
    else pushStatus.textContent = prepared.error || (serverStatus.enabled ? financeTr(state, 'Notifications désactivées sur cet appareil.') : financeTr(state, 'Notifications push désactivées sur ce serveur.'));
    updateDiagnostics();
  };
  const testButton = actionButton(financeTr(state, 'Envoyer une notification de test'), async () => {
    testButton.disabled = true;
    try { await sendPushTest(); pushStatus.textContent = financeTr(state, 'Notification de test ajoutée à la file d’envoi.'); }
    catch (error) { pushStatus.textContent = financeTr(state, error.message || 'Envoi impossible.'); }
    finally { testButton.disabled = false; }
  }, 'secondary-wide');
  testButton.disabled = true;
  refreshPush().catch(error => { input.disabled = true; testButton.disabled = true; pushStatus.textContent = error.message || financeTr(state, 'Statut des notifications push indisponible.'); lastActivationError = error.message || ''; updateDiagnostics(); });
  pushActions.append(testButton, pushStatus, diagnostic);
  alerts.append(pushActions);
  app.append(hero, settingsSection(financeTr(state, 'Préférences générales'), 'settings', general), settingsSection(financeTr(state, 'Notifications'), 'bell', alerts), status);
  heading.focus({ preventScroll: true });
}
