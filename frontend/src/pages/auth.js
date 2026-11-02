import { createField } from '../components/formField.js';
import { validateLogin, validateSignup } from '../domain/validation.js';

const icons = {
  user: '<svg aria-hidden="true" viewBox="0 0 32 32"><circle cx="16" cy="10" r="5"/><path d="M6 27c0-5 4.5-8 10-8s10 3 10 8"/></svg>',
  email: '<svg aria-hidden="true" viewBox="0 0 32 32"><rect x="4" y="7" width="24" height="18" rx="3"/><path d="m5 9 11 9L27 9"/></svg>',
  lock: '<svg aria-hidden="true" viewBox="0 0 32 32"><rect x="6" y="14" width="20" height="14" rx="3"/><path d="M10 14V9a6 6 0 0 1 12 0v5"/></svg>',
};

export function createAuthPage(app, route, navigate) {
  const isSignup = route === 'signup';
  app.className = 'auth-page';
  app.removeAttribute('aria-labelledby');
  app.replaceChildren();

  const back = document.createElement('button');
  back.className = 'back-button';
  back.type = 'button';
  back.setAttribute('aria-label', 'Retour à l’accueil');
  back.innerHTML = '<svg aria-hidden="true" viewBox="0 0 32 32"><path d="M26 16H6M14 8l-8 8 8 8"/></svg>';
  back.addEventListener('click', () => { window.history.pushState({}, '', window.location.pathname); window.location.reload(); });

  const content = document.createElement('div');
  content.className = 'auth-content';
  content.append(createBrand(), createHeading(isSignup));

  const hero = document.createElement('div');
  hero.className = 'auth-hero';
  const mascot = document.createElement('img');
  mascot.className = 'auth-mascot';
  mascot.src = './public/assets/mascots/welcome_open_arms.png';
  mascot.alt = 'Mascotte Moni';
  hero.append(mascot);

  const card = document.createElement('section');
  card.className = 'auth-card';
  const form = document.createElement('form');
  form.noValidate = true;
  form.setAttribute('aria-label', isSignup ? 'Créer un compte' : 'Se connecter');
  const fields = isSignup
    ? [
      createField({ id: 'fullName', label: 'Nom complet', autocomplete: 'name', icon: icons.user }),
      createField({ id: 'email', label: 'Adresse e-mail', type: 'email', autocomplete: 'email', icon: icons.email }),
      createField({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'new-password', icon: icons.lock, togglePassword: true }),
      createField({ id: 'confirmPassword', label: 'Confirmer le mot de passe', type: 'password', autocomplete: 'new-password', icon: icons.lock, togglePassword: true }),
    ]
    : [
      createField({ id: 'email', label: 'Adresse e-mail', type: 'email', autocomplete: 'email', icon: icons.email }),
      createField({ id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'current-password', icon: icons.lock, togglePassword: true }),
    ];
  fields.forEach((field) => form.append(field));

  const status = document.createElement('p');
  status.className = 'auth-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  if (!isSignup) form.append(createLoginOptions(status));
  const submit = document.createElement('button');
  submit.className = 'auth-submit';
  submit.type = 'submit';
  submit.textContent = isSignup ? 'Créer mon compte' : 'Se connecter';
  form.append(submit);

  form.append(status);
  form.addEventListener('submit', (event) => handleSubmit(event, form, status, isSignup, navigate));
  card.append(form, createSwitch(isSignup, navigate));
  content.append(hero, card);
  app.append(back, content);
}

function createBrand() {
  const brand = document.createElement('div');
  brand.className = 'brand auth-brand';
  brand.setAttribute('aria-label', 'Moni');
  brand.innerHTML = '<span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span class="brand-name">Moni</span><span class="brand-spark" aria-hidden="true"><i></i><i></i></span>';
  return brand;
}

function createHeading(isSignup) {
  const heading = document.createElement('div');
  heading.className = 'auth-heading';
  const title = document.createElement('h1');
  title.textContent = isSignup ? 'Créer un compte' : 'Se connecter';
  heading.append(title);
  if (!isSignup) {
    const subtitle = document.createElement('p');
    subtitle.innerHTML = 'Accède à ton espace et reprends<br />le contrôle de ton budget';
    heading.append(subtitle);
  }
  return heading;
}

function createLoginOptions(status) {
  const options = document.createElement('div');
  options.className = 'login-options';
  options.innerHTML = '<label><input type="checkbox" name="remember" /> <span>Se souvenir de moi</span></label><a href="#forgot-password" data-demo-link>Mot de passe oublié ?</a>';
  options.querySelector('[data-demo-link]').addEventListener('click', (event) => {
    event.preventDefault();
    status.textContent = 'Démonstration uniquement : la récupération sera disponible avec le backend.';
  });
  return options;
}

function createSwitch(isSignup, navigate) {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-switch';
  const text = document.createElement('span');
  text.textContent = isSignup ? 'Déjà un compte ?' : 'Pas encore de compte ?';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = isSignup ? 'Se connecter' : 'Créer un compte';
  button.addEventListener('click', () => navigate(isSignup ? 'login' : 'signup'));
  wrapper.append(text, button);
  return wrapper;
}

function handleSubmit(event, form, status, isSignup, navigate) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  const errors = isSignup ? validateSignup(values) : validateLogin(values);
  form.querySelectorAll('.field').forEach((field) => {
    const input = field.querySelector('input');
    const error = field.querySelector('.field-error');
    const message = errors[input.name] || '';
    error.textContent = message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    input.setAttribute('aria-describedby', message ? error.id : '');
    field.classList.toggle('field--error', Boolean(message));
  });
  status.textContent = Object.keys(errors).length ? 'Vérifie les champs signalés.' : 'Démonstration uniquement : aucune donnée n’a été envoyée.';
  if (Object.keys(errors).length) form.querySelector('.field--error input').focus();
  if (!Object.keys(errors).length) navigate('currency');
}
