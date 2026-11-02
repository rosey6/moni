export function createField({ id, label, type = 'text', autocomplete, icon, togglePassword = false }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  const labelElement = document.createElement('label');
  labelElement.className = 'sr-only';
  labelElement.htmlFor = id;
  labelElement.textContent = label;
  const control = document.createElement('div');
  control.className = 'field-control';
  control.innerHTML = `${icon}<input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" placeholder="${label}" />`;

  if (togglePassword) {
    const toggle = document.createElement('button');
    toggle.className = 'password-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', `Afficher ${label.toLowerCase()}`);
    toggle.setAttribute('aria-pressed', 'false');
    toggle.innerHTML = eyeIcon(false);
    toggle.addEventListener('click', () => {
      const input = control.querySelector('input');
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      toggle.setAttribute('aria-label', `${visible ? 'Afficher' : 'Masquer'} ${label.toLowerCase()}`);
      toggle.setAttribute('aria-pressed', String(!visible));
      toggle.innerHTML = eyeIcon(!visible);
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
  return visible
    ? '<svg aria-hidden="true" viewBox="0 0 32 32"><path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z"/><circle cx="16" cy="16" r="3"/></svg>'
    : '<svg aria-hidden="true" viewBox="0 0 32 32"><path d="M4 4l24 24M13 9a14 14 0 0 1 3-.3c8 0 13 7.3 13 7.3a24 24 0 0 1-4.2 4.5M8.2 8.8C5 11.2 3 16 3 16s5 8 13 8a13 13 0 0 0 5-.9"/></svg>';
}
