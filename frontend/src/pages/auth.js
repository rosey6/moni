import { earlyText as tr } from '../app/i18nEarly.js?v=full-i18n-20261122';
import { createField } from '../components/formField.js';
import { createIcon } from '../components/icon.js';
import { validateLogin, validateSignup } from '../domain/validation.js';
import { getPrivacyPolicy, login, privacyPolicyUrl, register } from '../app/api.js';
import { applyAuthResult } from '../app/serverState.js';
import { financeState, resetFinanceState } from '../app/financeState.js';

const icons = {
  user: 'user-round',
  email: 'mail',
  lock: 'lock-keyhole',
};

export function authLandingRoute(isSignup, state) {
  return !isSignup && state.onboardingCompleted ? 'dashboard' : 'currency';
}

export function createAuthPage(app, route, navigate) {
  const isSignup = route === 'signup';
  app.className = 'auth-page';
  app.removeAttribute('aria-labelledby');
  app.replaceChildren();

  const back = document.createElement('button');
  back.className = 'back-button';
  back.type = 'button';
  back.setAttribute('aria-label', tr("Retour à l’accueil"));
  back.append(createIcon('arrow-left'));
  back.addEventListener('click', () => navigate(''));

  const content = document.createElement('div');
  content.className = 'auth-content';
  content.append(createBrand(), createHeading(isSignup));

  const card = document.createElement('section');
  card.className = 'auth-card';
  card.setAttribute('oai-annotation-container', '');
  const form = document.createElement('form');
  form.noValidate = true;
  form.setAttribute('aria-label', isSignup ? tr("Créer un compte") : tr("Se connecter"));
  const fields = isSignup
    ? [
      createField({ id: 'fullName', label: tr("Nom complet"), autocomplete: 'name', icon: icons.user }),
      createField({ id: 'email', label: tr("Adresse e-mail"), type: 'email', autocomplete: 'email', icon: icons.email }),
      createField({ id: 'password', label: tr("Mot de passe"), type: 'password', autocomplete: 'new-password', icon: icons.lock, togglePassword: true }),
      createField({ id: 'confirmPassword', label: tr("Confirmer le mot de passe"), type: 'password', autocomplete: 'new-password', icon: icons.lock, togglePassword: true }),
    ]
    : [
      createField({ id: 'email', label: tr("Adresse e-mail"), type: 'email', autocomplete: 'email', icon: icons.email }),
      createField({ id: 'password', label: tr("Mot de passe"), type: 'password', autocomplete: 'current-password', icon: icons.lock, togglePassword: true }),
    ];
  fields.forEach((field) => form.append(field));

  const status = document.createElement('p');
  status.className = 'auth-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  if (!isSignup) form.append(createLoginOptions(status, navigate));
  else {
    const consent = document.createElement('label');
    consent.className = 'auth-consent';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.name = 'privacyAccepted'; checkbox.required = true;
    const copy = document.createElement('span');
    copy.append(document.createTextNode(tr('J’accepte la ') ));
    const link = document.createElement('a');
    link.href = privacyPolicyUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = tr('politique de confidentialité');
    copy.append(link);
    consent.append(checkbox, copy);
    form.append(consent);
    getPrivacyPolicy().then(policy => { form.dataset.privacyPolicyVersion = policy.version; }).catch(() => { status.textContent = tr('La politique de confidentialité n’est pas encore disponible.'); });
  }
  const submit = document.createElement('button');
  submit.dataset.authSubmit = 'true';
  submit.className = 'auth-submit';
  submit.type = 'submit';
  submit.textContent = isSignup ? tr("Créer mon compte") : tr("Se connecter");
  form.append(submit);

  form.append(status);
  form.addEventListener('submit', (event) => handleSubmit(event, form, status, submit, isSignup, navigate));
  card.append(form, createSwitch(isSignup, navigate));
  content.append(card);
  app.append(back, content);
}

function createBrand() {
  const brand = document.createElement('div');
  brand.className = 'brand auth-brand';
  brand.setAttribute('aria-label', 'Moni');
  brand.innerHTML = '<img class="brand-logo" src="./public/assets/brand/moni-organique.png" alt="Moni" />';
  return brand;
}

function createHeading(isSignup) {
  const heading = document.createElement('div');
  heading.className = 'auth-heading';
  const title = document.createElement('h1');
  title.textContent = isSignup ? tr("Créer un compte") : tr("Se connecter");
  heading.append(title);
  const subtitle = document.createElement('p');
  subtitle.textContent = tr(isSignup ? 'Commence à gérer ton budget.' : 'Heureux de te retrouver !');
  heading.append(subtitle);
  return heading;
}

function createLoginOptions(status, navigate) {
  const options = document.createElement('div');
  options.className = 'login-options';
  options.innerHTML = '<label><input type="checkbox" name="remember" /> <span>Se souvenir de moi</span></label><a href="#forgot-password" data-demo-link>Mot de passe oublié ?</a>';
  options.querySelector('span').textContent = tr('Se souvenir de moi');
  options.querySelector('[data-demo-link]').textContent = tr('Mot de passe oublié ?');
  options.querySelector('[data-demo-link]').addEventListener('click', (event) => {
    event.preventDefault();
    navigate('forgot-password');
  });
  return options;
}

function createSwitch(isSignup, navigate) {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-switch';
  const text = document.createElement('span');
  text.textContent = isSignup ? tr("Déjà un compte ?") : tr("Pas encore de compte ?");
  const link = document.createElement('a');
  link.href = `#${isSignup ? 'login' : 'signup'}`;
  link.textContent = isSignup ? tr("Se connecter") : tr("Créer un compte");
  link.addEventListener('click', event => { event.preventDefault(); navigate(isSignup ? 'login' : 'signup'); });
  wrapper.append(text, link);
  return wrapper;
}

async function handleSubmit(event, form, status, submit, isSignup, navigate) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  const errors = isSignup ? validateSignup(values) : validateLogin(values);
  form.querySelectorAll('.field').forEach((field) => {
    const input = field.querySelector('input');
    const error = field.querySelector('.field-error');
    const message = tr(errors[input.name] || '');
    error.textContent = message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    input.setAttribute('aria-describedby', message ? error.id : '');
    field.classList.toggle('field--error', Boolean(message));
  });
  const consent = form.querySelector('[name=privacyAccepted]');
  if (consent) consent.setAttribute('aria-invalid', String(Boolean(errors.privacyAccepted)));
  status.textContent = errors.privacyAccepted ? tr(errors.privacyAccepted) : Object.keys(errors).length ? tr("Vérifie les champs signalés.") : '';
  if (Object.keys(errors).length) (form.querySelector('.field--error input') || consent).focus();
  if (Object.keys(errors).length) return;
  if (isSignup && !form.dataset.privacyPolicyVersion) { status.textContent = tr('La politique de confidentialité n’est pas encore disponible.'); return; }
  submit.disabled = true;
  submit.setAttribute('aria-busy', 'true');
  status.textContent = tr('Connexion au serveur…');
  try {
    if (isSignup) resetFinanceState();
    const result = isSignup
      ? await register({ name: values.fullName, email: values.email, password: values.password, currency: financeState.currency, privacyAccepted: true, privacyPolicyVersion: form.dataset.privacyPolicyVersion })
      : await login({ email: values.email, password: values.password });
    applyAuthResult(financeState, result);
    navigate(authLandingRoute(isSignup, financeState));
  } catch (exception) {
    status.textContent = tr(exception.message || 'Le serveur Moni est indisponible.');
  } finally {
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
  }
}
