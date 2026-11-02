export function currencyDigits(currency) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}

export function formatMoney(amount, currency) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount / 10 ** currencyDigits(currency));
}

export function formatAmount(amount, currency) {
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount / 10 ** digits);
}

export function inputAmount(amount, currency) {
  const digits = currencyDigits(currency);
  const text = String(amount).padStart(digits + 1, '0');
  return digits ? text.slice(0, -digits) + '.' + text.slice(-digits) : text;
}
