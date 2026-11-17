// Les valeurs individuelles conservent la limite historique ; les totaux restent dans la plage entière JSON exacte.
export const MAX_AMOUNT = Math.floor(Number.MAX_SAFE_INTEGER / 8);
export const MAX_TOTAL = Number.MAX_SAFE_INTEGER;

export function validAmount(value, allowZero = true) {
  return Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= MAX_AMOUNT;
}

export function sumAmounts(amounts) {
  return amounts.reduce((sum, amount) => {
    if (!validAmount(amount) || sum > MAX_TOTAL - amount) throw new RangeError('Total monétaire trop élevé ou montant invalide.');
    return sum + amount;
  }, 0);
}

export function currencyDigits(currency) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}

function exactFormat(amount, currency, options) {
  if (!Number.isSafeInteger(amount)) throw new RangeError('Montant invalide.');
  const digits = currencyDigits(currency);
  const absolute = BigInt(Math.abs(amount));
  const divisor = 10n ** BigInt(digits);
  const whole = absolute / divisor;
  const fraction = String(absolute % divisor).padStart(digits, '0');
  const signed = amount < 0 ? (whole === 0n ? -0 : -whole) : whole;
  return new Intl.NumberFormat(typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-US' : 'fr-FR', options).formatToParts(signed)
    .map((part) => part.type === 'fraction' ? fraction : part.value).join('');
}

export function formatMoney(amount, currency, currencyDisplay = 'symbol') {
  return exactFormat(amount, currency, { style: 'currency', currency, currencyDisplay });
}

export function formatAmount(amount, currency) {
  const digits = currencyDigits(currency);
  return exactFormat(amount, currency, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function inputAmount(amount, currency) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('Montant invalide.');
  const digits = currencyDigits(currency);
  const text = String(amount).padStart(digits + 1, '0');
  return digits ? text.slice(0, -digits) + '.' + text.slice(-digits) : text;
}
