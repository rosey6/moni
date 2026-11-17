import { createIcon } from './icon.js';
import { createFontAwesomeIcon, hasFontAwesomeIcon } from './fontAwesome.js';

const FONT_AWESOME_FIELDS = { 'user-round': 'faUser', mail: 'faEnvelope', 'lock-keyhole': 'faLock' };

export function createField({ id, label, type = 'text', autocomplete, icon, togglePassword = false }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  wrapper.setAttribute('oai-annotatable', label);
  const labelElement = document.createElement('label');
  labelElement.className = 'field-label';
  labelElement.htmlFor = id;
  labelElement.textContent = label;
  const control = document.createElement('div');
  control.className = 'field-control';
  const input = document.createElement('input');
  input.id = id; input.name = id; input.type = type; input.autocomplete = autocomplete;
  const fieldIcon = FONT_AWESOME_FIELDS[icon];
  control.append(fieldIcon && hasFontAwesomeIcon(fieldIcon) ? createFontAwesomeIcon(fieldIcon) : createIcon(icon), input);

  if (togglePassword) {
    const english = document.documentElement.lang === 'en';
    const toggle = document.createElement('button');
    toggle.className = 'password-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', `${english ? 'Show' : 'Afficher'} ${label.toLowerCase()}`);
    toggle.setAttribute('aria-pressed', 'false');
    toggle.append(eyeIcon(false));
    toggle.addEventListener('click', () => {
      const input = control.querySelector('input');
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      toggle.setAttribute('aria-label', `${visible ? (english ? 'Show' : 'Afficher') : (english ? 'Hide' : 'Masquer')} ${label.toLowerCase()}`);
      toggle.setAttribute('aria-pressed', String(!visible));
      toggle.replaceChildren(eyeIcon(!visible));
    });
    control.append(toggle);
  }

  const error = document.createElement('p');
  error.className = 'field-error';
  error.id = `${id}-error`;
  error.setAttribute('aria-live', 'polite');
  wrapper.append(labelElement, control, error);
  return wrapper;
}

function eyeIcon(visible) {
  return createFontAwesomeIcon(visible ? 'faEye' : 'faEyeSlash');
}
