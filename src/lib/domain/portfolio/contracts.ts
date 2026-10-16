// src/lib/domain/portfolio/contracts.ts
// NSE futures and options: trading symbols, underlying lookups and settlement values.
// Symbols follow NSE (and Zerodha): NIFTY26OCTFUT, NIFTY26OCT24500CE (monthly), NIFTY26O1924500PE (weekly).

import type { Contract } from './positions';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// Weekly contracts use 1-9 for Jan-Sep and O, N, D for Oct-Dec.
const WEEKLY_MONTH = '123456789OND';

export type ParsedSymbol = {
  underlying: string;
  kind: 'future' | 'option';
  /** Exact for weekly contracts; monthly contracts only give year and month. */
  expiry?: string;
  year: number;
  month: number; // 1-12
  strike?: number;
  optionType?: 'CE' | 'PE';
};

/** Read what a symbol says about its contract. Undefined when it isn't an NSE F&O symbol. */
export function parseNseSymbol(raw: string): ParsedSymbol | undefined {
  const s = raw.trim().toUpperCase();
  let m = /^([A-Z0-9&-]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/.exec(s);
  if (m) {
    return { underlying: m[1], kind: 'future', year: 2000 + Number(m[2]), month: MONTHS.indexOf(m[3]) + 1 };
  }
  m = /^([A-Z0-9&-]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+(?:\.\d+)?)(CE|PE)$/.exec(s);
  if (m) {
    return {
      underlying: m[1],
      kind: 'option',
      year: 2000 + Number(m[2]),
      month: MONTHS.indexOf(m[3]) + 1,
      strike: Number(m[4]),
      optionType: m[5] as 'CE' | 'PE',
    };
  }
  m = /^([A-Z0-9&-]+?)(\d{2})([1-9OND])(\d{2})(\d+(?:\.\d+)?)(CE|PE)$/.exec(s);
  if (m) {
    const year = 2000 + Number(m[2]);
    const month = WEEKLY_MONTH.indexOf(m[3]) + 1;
    const day = Number(m[4]);
    if (day < 1 || day > 31) return undefined;
    return {
      underlying: m[1],
      kind: 'option',
      year,
      month,
      expiry: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      strike: Number(m[5]),
      optionType: m[6] as 'CE' | 'PE',
    };
  }
  return undefined;
}

/**
 * Last Tuesday of a month: NSE's monthly expiry since September 2025 (Thursday before).
 * Only a fallback; the bhavcopy gives the real date, which can move for holidays.
 */
export function monthlyExpiry(year: number, month: number): string {
  const weekday = year > 2025 || (year === 2025 && month >= 9) ? 2 : 4;
  const last = new Date(Date.UTC(year, month, 0));
  const back = (last.getUTCDay() - weekday + 7) % 7;
  last.setUTCDate(last.getUTCDate() - back);
  return last.toISOString().slice(0, 10);
}

/** Contract details from a symbol alone, using the monthly-expiry fallback when needed. */
export function contractFromSymbol(symbol: string, lotSize?: number): Contract | undefined {
  const p = parseNseSymbol(symbol);
  if (!p) return undefined;
  return {
    underlying: p.underlying,
    expiry: p.expiry ?? monthlyExpiry(p.year, p.month),
    strike: p.strike,
    optionType: p.optionType,
    lotSize,
  };
}

const INDEX_SYMBOLS: Record<string, string> = {
  NIFTY: '^NSEI',
  BANKNIFTY: '^NSEBANK',
  FINNIFTY: 'NIFTY_FIN_SERVICE.NS',
  MIDCPNIFTY: 'NIFTY_MID_SELECT.NS',
  NIFTYNXT50: '^NSMIDCP',
  SENSEX: '^BSESN',
  BANKEX: 'BSE-BANK.BO',
};

/** Yahoo symbol for an underlying's spot price: indices by name, stocks on NSE. */
export function underlyingYahooSymbol(underlying: string): string {
  const u = underlying.toUpperCase();
  return INDEX_SYMBOLS[u] ?? `${u}.NS`;
}

/** What a contract pays per unit at expiry given the underlying's closing price. */
export function intrinsicValue(c: Contract, spot: number, type: 'future' | 'option'): number {
  if (type === 'future') return spot;
  const k = c.strike ?? 0;
  return c.optionType === 'PE' ? Math.max(0, k - spot) : Math.max(0, spot - k);
}

/** "NIFTY 24,500 CE · 27 Oct" style label parts. */
export function contractLabel(c: Contract, type: string): string {
  const d = new Date(`${c.expiry}T00:00:00Z`);
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].charAt(0)}${MONTHS[d.getUTCMonth()].slice(1).toLowerCase()}`;
  if (type === 'future') return `${c.underlying} FUT · ${date}`;
  return `${c.underlying} ${c.strike?.toLocaleString('en-IN')} ${c.optionType} · ${date}`;
}
