// src/lib/domain/portfolio/tax.ts
// Tax years and holding periods for realized gains. Not tax advice: no rates, no exemptions,
// just the grouping every tax form starts from.

import type { Realization } from './positions';
import { cashSign, type CashEntryLike } from './money';

export type Term = 'short' | 'long';

/** Year a date falls in for a tax year starting on `startMonth` (1 = calendar year, 4 = India's April–March). */
export function taxYearOf(date: string, startMonth: number): number {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return startMonth === 1 || m >= startMonth ? y : y - 1;
}

/** "2025" for calendar years, "FY 2025–26" otherwise. */
export function taxYearLabel(year: number, startMonth: number): string {
  if (startMonth === 1) return String(year);
  return `FY ${year}–${String((year + 1) % 100).padStart(2, '0')}`;
}

/** First and last day of a tax year (inclusive). */
export function taxYearRange(year: number, startMonth: number): { from: string; to: string } {
  const from = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year + 1, startMonth - 1, 1) - 86400000);
  return { from, to: end.toISOString().slice(0, 10) };
}

/** Long-term once held for more than `months` months (sold after the anniversary). */
export function termOf(openedAt: string, closedAt: string, months: number): Term {
  const o = new Date(openedAt);
  const limit = Date.UTC(o.getUTCFullYear(), o.getUTCMonth() + months, o.getUTCDate());
  return new Date(closedAt).getTime() > limit ? 'long' : 'short';
}

export function daysHeld(openedAt: string, closedAt: string) {
  return Math.max(0, Math.round((Date.parse(closedAt.slice(0, 10)) - Date.parse(openedAt.slice(0, 10))) / 86400000));
}

/** One line on a capital gains statement: one sale, one term. */
export type SaleRow = {
  key: string;
  tradeId?: string;
  symbol: string;
  type: string;
  platform: string;
  currency?: string;
  direction: 'long' | 'short';
  term: Term;
  closedAt: string;
  firstOpenedAt: string;
  lastOpenedAt: string;
  quantity: number;
  cost: number;
  proceeds: number;
  pnl: number;
  costBase?: number;
  proceedsBase?: number;
  pnlBase?: number;
  settled: boolean;
};

/** Group lot slices into one row per closing trade and term. */
export function saleRows(realizations: Realization[], longTermMonths: number): SaleRow[] {
  const rows = new Map<string, SaleRow>();
  for (const r of realizations) {
    // Shorts are always short-term gains (business income for F&O in India; short-term elsewhere).
    const term: Term = r.direction === 'short' || r.type === 'future' || r.type === 'option' ? 'short' : termOf(r.openedAt, r.closedAt, longTermMonths);
    const k = `${r.tradeId ?? `${r.key}@${r.closedAt}`}|${r.key}|${term}`;
    const row = rows.get(k);
    if (!row) {
      rows.set(k, {
        key: k,
        tradeId: r.tradeId,
        symbol: r.symbol,
        type: String(r.type),
        platform: r.platform,
        currency: r.currency,
        direction: r.direction,
        term,
        closedAt: r.closedAt,
        firstOpenedAt: r.openedAt,
        lastOpenedAt: r.openedAt,
        quantity: r.quantity,
        cost: r.cost,
        proceeds: r.proceeds,
        pnl: r.pnl,
        costBase: r.costBase,
        proceedsBase: r.proceedsBase,
        pnlBase: r.pnlBase,
        settled: Boolean(r.settled),
      });
      continue;
    }
    row.quantity += r.quantity;
    row.cost += r.cost;
    row.proceeds += r.proceeds;
    row.pnl += r.pnl;
    const addBase = (a?: number, b?: number) => (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b) ? undefined : a + b);
    row.costBase = addBase(row.costBase, r.costBase);
    row.proceedsBase = addBase(row.proceedsBase, r.proceedsBase);
    row.pnlBase = addBase(row.pnlBase, r.pnlBase);
    if (r.openedAt < row.firstOpenedAt) row.firstOpenedAt = r.openedAt;
    if (r.openedAt > row.lastOpenedAt) row.lastOpenedAt = r.openedAt;
  }
  return Array.from(rows.values()).sort((a, b) => (a.closedAt < b.closedAt ? 1 : a.closedAt > b.closedAt ? -1 : a.symbol.localeCompare(b.symbol)));
}

export type YearSummary = {
  year: number;
  label: string;
  shortTerm: number;
  longTerm: number;
  /** Futures and options, kept apart because many tax systems treat them differently. */
  derivatives: number;
  dividends: number;
  interest: number;
  charges: number;
  partial: boolean;
};

/** Realized gains, income and charges per tax year, newest first, in the base currency. */
export function yearSummaries(args: {
  sales: SaleRow[];
  cash: (CashEntryLike & { amountBase?: number })[];
  startMonth: number;
}): YearSummary[] {
  const years = new Map<number, YearSummary>();
  const get = (date: string) => {
    const y = taxYearOf(date.slice(0, 10), args.startMonth);
    let s = years.get(y);
    if (!s) {
      s = { year: y, label: taxYearLabel(y, args.startMonth), shortTerm: 0, longTerm: 0, derivatives: 0, dividends: 0, interest: 0, charges: 0, partial: false };
      years.set(y, s);
    }
    return s;
  };
  for (const r of args.sales) {
    const s = get(new Date(r.closedAt).toISOString());
    if (r.pnlBase === undefined || Number.isNaN(r.pnlBase)) {
      s.partial = true;
      continue;
    }
    if (r.type === 'future' || r.type === 'option') s.derivatives += r.pnlBase;
    else if (r.term === 'long') s.longTerm += r.pnlBase;
    else s.shortTerm += r.pnlBase;
  }
  for (const c of args.cash) {
    if (c.kind === 'deposit' || c.kind === 'withdrawal') continue;
    const s = get(new Date(c.occurredAt).toISOString());
    if (c.amountBase === undefined) {
      s.partial = true;
      continue;
    }
    if (c.kind === 'dividend') s.dividends += c.amountBase;
    else if (c.kind === 'interest') s.interest += c.amountBase;
    else s.charges += Math.abs(c.amountBase) * -cashSign(c.kind);
  }
  return Array.from(years.values()).sort((a, b) => b.year - a.year);
}
