// src/lib/domain/fx/rates.ts
// Pure FX helpers. Every rate is stored as "USD per 1 unit of currency" for a date,
// and any pair converts through USD: a→b = usdPerUnit[a] / usdPerUnit[b].

import type { FxLookup } from '../portfolio/positions';

export type UsdRateRow = {
  date: string; // YYYY-MM-DD
  currency: string; // ISO 4217, upper case
  usdPerUnit: number;
};

/**
 * Minor-unit quote currencies some exchanges use. Case matters: Yahoo reports
 * London prices as 'GBp' (pence), while 'GBP' means pounds.
 */
const MINOR_UNITS: Record<string, { major: string; divisor: number }> = {
  GBp: { major: 'GBP', divisor: 100 },
  GBX: { major: 'GBP', divisor: 100 },
  ZAc: { major: 'ZAR', divisor: 100 },
  ILA: { major: 'ILS', divisor: 100 },
};

/** Normalize a quote currency to its major unit: 'GBp' → { currency: 'GBP', factor: 0.01 }. */
export function normalizeCurrency(currency: string): { currency: string; factor: number } {
  const m = MINOR_UNITS[currency];
  if (m) return { currency: m.major, factor: 1 / m.divisor };
  return { currency: currency.toUpperCase(), factor: 1 };
}

/**
 * Build an FX lookup from daily USD rates.
 * Uses the latest rate on or before the date (weekends and holidays carry forward).
 * If the date is before the first known rate, the first known rate is used.
 */
export function makeFxLookup(rows: UsdRateRow[]): FxLookup {
  const byCcy = new Map<string, { dates: string[]; rates: number[] }>();
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const r of sorted) {
    if (!(r.usdPerUnit > 0)) continue;
    const ccy = r.currency.toUpperCase();
    const s = byCcy.get(ccy) ?? { dates: [], rates: [] };
    s.dates.push(r.date);
    s.rates.push(r.usdPerUnit);
    byCcy.set(ccy, s);
  }

  const usdPerUnit = (ccy: string, date: string): number | undefined => {
    if (ccy === 'USD') return 1;
    const s = byCcy.get(ccy);
    if (!s || !s.dates.length) return undefined;
    // binary search: last index with dates[i] <= date
    let lo = 0;
    let hi = s.dates.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (s.dates[mid] <= date) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return s.rates[found >= 0 ? found : 0];
  };

  return (from, to, date) => {
    const a = from.toUpperCase();
    const b = to.toUpperCase();
    if (a === b) return 1;
    const ua = usdPerUnit(a, date);
    const ub = usdPerUnit(b, date);
    if (ua === undefined || ub === undefined) return undefined;
    return ua / ub;
  };
}
