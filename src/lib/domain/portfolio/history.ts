// src/lib/domain/portfolio/history.ts
// Replays trades over daily closes to get portfolio value and cost basis per day,
// all in the base currency. Pure: prices and FX are passed in.

import {
  applyTrade,
  assetKey,
  sortTrades,
  tradeDate,
  tradeRateToBase,
  type FxLookup,
  type Ledger,
  type TradeLike,
} from './positions';
import type { CashFlow } from './xirr';

export type PricePoint = { date: string; close: number };

/** Daily closes for one asset, ascending by date, in major units of `currency`. */
export type PriceSeries = { currency: string; points: PricePoint[] };

export type HistoryPoint = {
  date: string;
  value: number;
  costBasis: number;
  /** True when some holding had no close or FX yet and fell back to its last trade price (or was skipped). */
  partial: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: string, n: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Value and cost basis for every calendar day from the first trade to `end` (inclusive).
 * `prices` is keyed by `assetKey(symbol, type)`.
 */
export function buildHistory(args: {
  trades: TradeLike[];
  prices: Map<string, PriceSeries>;
  baseCurrency: string;
  fx: FxLookup;
  end: string;
}): HistoryPoint[] {
  const { prices, baseCurrency, fx, end } = args;
  const trades = sortTrades(args.trades);
  if (!trades.length) return [];

  const ledger: Ledger = new Map();
  const lastTrade = new Map<string, { price: number; currency: string }>();
  const cursor = new Map<string, number>();
  const out: HistoryPoint[] = [];

  let ti = 0;
  for (let date = tradeDate(trades[0]); date <= end; date = addDays(date, 1)) {
    while (ti < trades.length && tradeDate(trades[ti]) <= date) {
      const t = trades[ti];
      applyTrade(ledger, t, tradeRateToBase(t, baseCurrency, fx));
      lastTrade.set(assetKey(t.asset.symbol, t.asset.type), {
        price: Number(t.price),
        currency: (t.currency ?? baseCurrency).toUpperCase(),
      });
      ti++;
    }

    let value = 0;
    let costBasis = 0;
    let partial = false;

    for (const [key, pos] of ledger) {
      if (pos.quantity <= 0) continue;
      costBasis += pos.costBasisBase ?? 0;
      if (pos.baseMissing) partial = true;

      let price: number | undefined;
      let currency: string | undefined;
      const series = prices.get(key);
      if (series && series.points.length) {
        let i = cursor.get(key) ?? -1;
        while (i + 1 < series.points.length && series.points[i + 1].date <= date) i++;
        cursor.set(key, i);
        if (i >= 0) {
          price = series.points[i].close;
          currency = series.currency;
        }
      }
      if (price === undefined) {
        const lt = lastTrade.get(key);
        price = lt?.price;
        currency = lt?.currency;
        partial = true;
      }

      const rate = currency ? fx(currency, baseCurrency, date) : undefined;
      if (price === undefined || rate === undefined) {
        partial = true;
        continue;
      }
      value += pos.quantity * price * rate;
    }

    out.push({ date, value, costBasis, partial });
  }

  return out;
}

/**
 * Cash flows in the base currency for XIRR: buys are negative, sells positive,
 * plus the current value as a final positive flow on `asOf`.
 */
export function portfolioCashFlows(args: {
  trades: TradeLike[];
  baseCurrency: string;
  fx: FxLookup;
  currentValue: number;
  asOf: string;
}): CashFlow[] | undefined {
  const flows: CashFlow[] = [];
  for (const t of sortTrades(args.trades)) {
    const rate = tradeRateToBase(t, args.baseCurrency, args.fx);
    if (rate === undefined) return undefined;
    const gross = Number(t.quantity) * Number(t.price);
    const fees = Number(t.fees ?? 0);
    flows.push({
      date: tradeDate(t),
      amount: t.side === 'BUY' ? -(gross + fees) * rate : (gross - fees) * rate,
    });
  }
  flows.push({ date: args.asOf, amount: args.currentValue });
  return flows;
}
