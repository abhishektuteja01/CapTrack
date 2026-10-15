// src/lib/format.ts
// One place for every number shown in the UI.
// Rules: true minus sign (U+2212), explicit + on changes, "—" for unknown values,
// locale per currency so rupees group as ₹12,34,567.

export const MINUS = '−';
export const NONE = '—';

/** Locale whose grouping and symbol placement match how each currency is usually written. */
const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
  HKD: 'en-HK',
  CHF: 'de-CH',
};

export function localeFor(currency: string) {
  return CURRENCY_LOCALE[currency.toUpperCase()] ?? 'en-US';
}

const cache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, opts: Intl.NumberFormatOptions) {
  const key = locale + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    cache.set(key, f);
  }
  return f;
}

function known(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function fixMinus(s: string) {
  return s.replace(/-/g, MINUS);
}

/** Default decimals for a currency (JPY 0, INR/USD 2, …). */
export function currencyDecimals(currency: string) {
  try {
    return nf('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Money in its own currency format.
 * `decimals` defaults to the currency's standard; pass 0 for large totals.
 */
export function money(v: number | null | undefined, currency: string, decimals?: number) {
  if (!known(v)) return NONE;
  const d = decimals ?? currencyDecimals(currency);
  try {
    return fixMinus(
      nf(localeFor(currency), {
        style: 'currency',
        currency,
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }).format(v)
    );
  } catch {
    // Unknown ISO code: fall back to "1,234.00 XYZ"
    return `${fixMinus(nf('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v))} ${currency}`;
  }
}

/** Money change with an explicit sign: +₹1,200 / −₹1,200. */
export function moneyDelta(v: number | null | undefined, currency: string, decimals?: number) {
  if (!known(v)) return NONE;
  const body = money(Math.abs(v), currency, decimals);
  return v > 0 ? `+${body}` : v < 0 ? `${MINUS}${body}` : body;
}

/** Percent value, not a ratio: pct(1.234) → "+1.23%". */
export function pct(v: number | null | undefined, decimals = 2, signed = true) {
  if (!known(v)) return NONE;
  const body = `${Math.abs(v).toFixed(decimals)}%`;
  if (!signed) return v < 0 ? `${MINUS}${body}` : body;
  return v > 0 ? `+${body}` : v < 0 ? `${MINUS}${body}` : body;
}

/** Quantity: up to 8 decimals, trailing zeros trimmed. Grouped in the base currency's locale. */
export function qty(v: number | null | undefined, currency = 'USD') {
  if (!known(v)) return NONE;
  return fixMinus(nf(localeFor(currency), { maximumFractionDigits: 8 }).format(v));
}

/** Short money for chart axes: ₹27L, ₹1.3Cr, $1.2M. */
export function compactMoney(v: number | null | undefined, currency: string) {
  if (!known(v)) return NONE;
  try {
    return fixMinus(
      nf(localeFor(currency), {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(v)
    );
  } catch {
    return money(v, currency, 0);
  }
}

/** Price per unit: keep more decimals for sub-1 prices (crypto, penny stocks). */
export function price(v: number | null | undefined, currency: string) {
  if (!known(v)) return NONE;
  const base = currencyDecimals(currency);
  return money(v, currency, Math.abs(v) < 1 && v !== 0 ? Math.max(base, 4) : base);
}

/** -1, 0, 1 for picking gain/loss styles. Unknown is 0. */
export function sign(v: number | null | undefined): -1 | 0 | 1 {
  if (!known(v) || v === 0) return 0;
  return v > 0 ? 1 : -1;
}

/** Exchange rate: 4 significant decimals, no symbol. */
export function rate(v: number | null | undefined) {
  if (!known(v)) return NONE;
  const d = Math.abs(v) >= 10 ? 2 : 4;
  return nf('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
}
