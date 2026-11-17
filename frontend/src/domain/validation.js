export function validateSignup(values) {
  const errors = {};
  if (!values.fullName.trim()) errors.fullName = 'Indique ton nom complet.';
  if (!isEmail(values.email)) errors.email = 'Saisis une adresse e-mail valide.';
  if (values.password.length < 8) errors.password = 'Le mot de passe doit contenir au moins 8 caractères.';
  if (values.privacyAccepted !== 'on') errors.privacyAccepted = 'Accepte la politique de confidentialité pour créer ton compte.';
  if (values.confirmPassword !== values.password) errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
  return errors;
}

export function validateLogin(values) {
  const errors = {};
  if (!isEmail(values.email)) errors.email = 'Saisis une adresse e-mail valide.';
  if (!values.password) errors.password = 'Saisis ton mot de passe.';
  return errors;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
