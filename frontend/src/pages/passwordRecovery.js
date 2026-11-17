import { earlyText as tr } from '../app/i18nEarly.js';
import { createField } from '../components/formField.js';
import { createIcon } from '../components/icon.js';
import { forgotPassword, resetPassword } from '../app/api.js';

function brand() {
  const element = document.createElement('div');
  element.className = 'brand auth-brand';
  element.setAttribute('aria-label', 'Moni');
  element.innerHTML = '<img class="brand-logo" src="./public/assets/brand/moni-organique.png" alt="Moni" />';
  return element;
}

function shell(app, navigate, title, subtitle) {
  app.className = 'auth-page';
  app.removeAttribute('aria-labelledby');
  app.replaceChildren();
  const back = document.createElement('button');
  back.className = 'back-button';
  back.type = 'button';
  back.setAttribute('aria-label', tr('Retour à la connexion'));
  back.append(createIcon('arrow-left'));
  back.addEventListener('click', () => navigate('login'));
  const content = document.createElement('div');
  content.className = 'auth-content';
  const heading = document.createElement('div');
  heading.className = 'auth-heading';
  const titleNode = document.createElement('h1');
  titleNode.textContent = title;
  heading.append(titleNode);
  if (subtitle) { const copy = document.createElement('p'); copy.textContent = subtitle; heading.append(copy); }
  const card = document.createElement('section');
  card.className = 'auth-card';
  content.append(brand(), heading, card);
  app.append(back, content);
  return card;
}

function statusNode() {
  const status = document.createElement('p');
  status.className = 'auth-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  return status;
}

export function createPasswordRecoveryPage(app, route, navigate, token = '') {
  if (route === 'forgot-password-sent') {
    const card = shell(app, navigate, tr('Vérifie ta boîte mail'), tr('Si un compte correspond à cette adresse, un lien valable 60 minutes vient d’être envoyé.'));
    const copy = document.createElement('p');
    copy.textContent = tr('Le lien est utilisable une seule fois. Tu peux fermer cette page après réception du message.');
    const action = document.createElement('button');
    action.className = 'auth-submit'; action.type = 'button'; action.textContent = tr('Retour à la connexion');
    action.addEventListener('click', () => navigate('login'));
    card.append(copy, action);
    return;
  }
  if (route === 'reset-password-success') {
    const card = shell(app, navigate, tr('Mot de passe modifié'), tr('Ton nouveau mot de passe est actif.'));
    const copy = document.createElement('p');
    copy.textContent = tr('Les sessions précédentes ont été révoquées. Connecte-toi à nouveau.');
    const action = document.createElement('button');
    action.className = 'auth-submit'; action.type = 'button'; action.textContent = tr('Se connecter');
    action.addEventListener('click', () => navigate('login'));
    card.append(copy, action);
    return;
  }
  if (route === 'forgot-password') {
    const card = shell(app, navigate, tr('Mot de passe oublié ?'), tr('Reçois un lien sécurisé pour en choisir un nouveau.'));
    const form = document.createElement('form'); form.noValidate = true;
    const email = createField({ id: 'email', label: tr('Adresse e-mail'), type: 'email', autocomplete: 'email', icon: 'mail' });
    const input = email.querySelector('input');
    const status = statusNode();
    const submit = document.createElement('button'); submit.className = 'auth-submit'; submit.type = 'submit'; submit.textContent = tr('Envoyer le lien');
    form.append(email, submit, status);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!input.value.trim() || !input.validity.valid) { status.textContent = tr('Saisis une adresse e-mail valide.'); input.focus(); return; }
      submit.disabled = true; status.textContent = tr('Envoi en cours…');
      try { await forgotPassword({ email: input.value }); navigate('forgot-password-sent'); }
      catch (exception) { status.textContent = tr(exception.message || 'Impossible d’envoyer le lien.'); }
      finally { submit.disabled = false; }
    });
    card.append(form);
    return;
  }

  const card = shell(app, navigate, tr('Nouveau mot de passe'), tr('Choisis un mot de passe différent et mémorisable.'));
  const form = document.createElement('form'); form.noValidate = true;
  const password = createField({ id: 'password', label: tr('Nouveau mot de passe'), type: 'password', autocomplete: 'new-password', icon: 'lock-keyhole', togglePassword: true });
  const confirmation = createField({ id: 'passwordConfirmation', label: tr('Confirmer le mot de passe'), type: 'password', autocomplete: 'new-password', icon: 'lock-keyhole', togglePassword: true });
  const first = password.querySelector('input');
  const second = confirmation.querySelector('input');
  const status = statusNode();
  const submit = document.createElement('button'); submit.className = 'auth-submit'; submit.type = 'submit'; submit.textContent = tr('Enregistrer le nouveau mot de passe');
  form.append(password, confirmation, submit, status);
  if (!token) status.textContent = tr('Ce lien de réinitialisation est invalide ou incomplet.');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (first.value.length < 8) { status.textContent = tr('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (first.value !== second.value) { status.textContent = tr('Les mots de passe ne correspondent pas.'); return; }
    if (!token) return;
    submit.disabled = true; status.textContent = tr('Enregistrement en cours…');
    try { await resetPassword({ token, password: first.value, passwordConfirmation: second.value }); navigate('reset-password-success'); }
    catch (exception) { status.textContent = tr(exception.message || 'Impossible de réinitialiser le mot de passe.'); }
    finally { submit.disabled = false; }
  });
  card.append(form);
}
