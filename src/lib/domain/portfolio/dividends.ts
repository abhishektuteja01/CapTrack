// src/lib/domain/portfolio/dividends.ts
// Dividends a holding should have paid but that aren't logged yet, from reported per-share amounts.

import { addDays } from './history';
import { assetKey, heldOn, platformName, type TradeLike } from './positions';
import type { CashEntryLike } from './money';
import type { Split } from './splits';

export type DividendEvent = { date: string; amount: number };

export type DividendSuggestion = {
  assetKey: string;
  symbol: string;
  type: string;
  platform: string;
  exDate: string;
  perShare: number;
  quantity: number;
  /** Gross, before any tax withheld, in `currency`. */
  amount: number;
  currency: string;
};

/**
 * Per-share amounts as paid on the day: Yahoo reports them split-adjusted, so undo every split dated after each one.
 */
export function unadjustDividends(events: DividendEvent[], splits: Split[]): DividendEvent[] {
  return events.map((e) => ({
    date: e.date,
    amount: splits.filter((s) => s.date > e.date).reduce((a, s) => a * s.ratio, e.amount),
  }));
}

/**
 * For each reported dividend, the units held on each platform the day before the ex-date.
 * Skips any that already have a dividend logged for that symbol and platform within 7 days before
 * to 75 days after the ex-date (payment usually lags).
 */
export function missingDividends(args: {
  trades: TradeLike[];
  cash: CashEntryLike[];
  events: Map<string, { currency: string; events: DividendEvent[] }>;
  splits?: Map<string, Split[]>;
  asOf: string;
}): DividendSuggestion[] {
  const out: DividendSuggestion[] = [];
  const logged = args.cash.filter((c) => c.kind === 'dividend');
  for (const [key, { currency, events }] of args.events) {
    const trades = args.trades.filter((t) => assetKey(t.asset.symbol, t.asset.type) === key);
    if (!trades.length) continue;
    const first = trades.reduce((m, t) => (t.occurredAt < m ? t.occurredAt : m), trades[0].occurredAt).slice(0, 10);
    const platforms = Array.from(new Set(trades.map((t) => platformName(t.platform))));
    const { symbol, type } = trades[0].asset;
    const splits = args.splits?.get(key) ?? [];
    for (const e of unadjustDividends(events, splits)) {
      if (e.date <= first || e.date > args.asOf) continue;
      for (const platform of platforms) {
        const quantity = heldOn(trades, { symbol, type }, platform, addDays(e.date, -1), args.splits);
        if (quantity <= 0) continue;
        const from = addDays(e.date, -7);
        const to = addDays(e.date, 75);
        const done = logged.some((c) => {
          const d = new Date(c.occurredAt).toISOString().slice(0, 10);
          return (
            (c.assetSymbol ?? '').toUpperCase() === symbol.toUpperCase() &&
            platformName(c.platform) === platform &&
            d >= from &&
            d <= to
          );
        });
        if (done) continue;
        out.push({ assetKey: key, symbol, type: String(type), platform, exDate: e.date, perShare: e.amount, quantity, amount: quantity * e.amount, currency });
      }
    }
  }
  return out.sort((a, b) => (a.exDate < b.exDate ? 1 : -1));
}
