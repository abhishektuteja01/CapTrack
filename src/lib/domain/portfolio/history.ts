// src/lib/domain/portfolio/history.ts
// Replays trades over daily closes to get portfolio value, net money invested and an optional
// benchmark per day, all in the base currency. Pure: prices and FX are passed in.

import {
  SplitCursor,
  applyTrade,
  assetKey,
  settleExpired,
  sortTrades,
  tradeDate,
  tradeRateToBase,
  type DerivePositionsOptions,
  type FxLookup,
  type Ledger,
  type TradeEffect,
  type TradeLike,
} from './positions';
import type { Split } from './splits';

export type PricePoint = { date: string; close: number };

/** Daily closes for one asset, ascending by date, in major units of `currency`, as actually traded (not split-adjusted). */
export type PriceSeries = { currency: string; points: PricePoint[] };

export type HistoryPoint = {
  date: string;
  /** Market value of everything held (futures count only their open P&L). */
  value: number;
  /** Cost of what's still held. */
  costBasis: number;
  /** Money put in minus money taken out, to date. Selling at a profit lowers it by the full proceeds. */
  invested: number;
  /** What the same money flows would be worth in the benchmark. */
  benchmark?: number;
  /** True when some holding had no close or FX yet and fell back to its last trade price (or was skipped). */
  partial: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: string, n: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Walks a price series forward in date order; `at(date)` is the latest close on or before it. */
export class SeriesCursor {
  private i = -1;
  constructor(private series: PriceSeries | undefined) {}
  at(date: string): number | undefined {
    const pts = this.series?.points;
    if (!pts?.length) return undefined;
    while (this.i + 1 < pts.length && pts[this.i + 1].date <= date) this.i++;
    return this.i >= 0 ? pts[this.i].close : undefined;
  }
  get currency() {
    return this.series?.currency;
  }
}

/** Latest close on or before `date` (binary search). */
export function closeOn(series: PriceSeries | undefined, date: string): number | undefined {
  const pts = series?.points;
  if (!pts?.length) return undefined;
  let lo = 0;
  let hi = pts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].date <= date) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found >= 0 ? pts[found].close : undefined;
}

/**
 * Value, cost basis, net invested and benchmark for every calendar day from the first trade to `end` (inclusive).
 * `prices` is keyed by `assetKey(symbol, type)`.
 */
export function buildHistory(args: {
  trades: TradeLike[];
  prices: Map<string, PriceSeries>;
  baseCurrency: string;
  fx: FxLookup;
  end: string;
  splits?: Map<string, Split[]>;
  method?: DerivePositionsOptions['method'];
  settlement?: DerivePositionsOptions['settlement'];
  benchmark?: PriceSeries;
}): HistoryPoint[] {
  const { prices, baseCurrency, fx, end } = args;
  const splits = new SplitCursor(args.splits);
  const trades = sortTrades(args.trades);
  if (!trades.length) return [];

  const ledger: Ledger = new Map();
  const lastTrade = new Map<string, { price: number; currency: string }>();
  const cursors = new Map<string, SeriesCursor>();
  const bench = args.benchmark?.points.length ? new SeriesCursor(args.benchmark) : undefined;
  const out: HistoryPoint[] = [];

  let invested = 0;
  let benchUnits = 0;
  let benchMissing = false;
  let ti = 0;

  for (let date = tradeDate(trades[0]); date <= end; date = addDays(date, 1)) {
    const benchPrice = bench?.at(date);
    const benchRate = bench?.currency ? fx(bench.currency, baseCurrency, date) : undefined;
    const benchBase = benchPrice !== undefined && benchRate !== undefined ? benchPrice * benchRate : undefined;
    const flow = (e: TradeEffect) => {
      if (e.cashBase === undefined) return;
      invested -= e.cashBase;
      if (!bench) return;
      if (benchBase) benchUnits += -e.cashBase / benchBase;
      else benchMissing = true;
    };

    for (const e of settleExpired(ledger, date, false, baseCurrency, fx, args.settlement, args.method)) flow(e);
    splits.advanceAll(ledger, date);
    while (ti < trades.length && tradeDate(trades[ti]) <= date) {
      const t = trades[ti];
      flow(applyTrade(ledger, t, tradeRateToBase(t, baseCurrency, fx), { method: args.method }));
      lastTrade.set(assetKey(t.asset.symbol, t.asset.type), {
        price: Number(t.price),
        currency: (t.currency ?? baseCurrency).toUpperCase(),
      });
      ti++;
    }

    let value = 0;
    let costBasis = 0;
    let partial = false;

    for (const pos of ledger.values()) {
      if (!pos.lots.length) continue;
      const cost = pos.lots.reduce((s, l) => s + l.qty * l.unitCostBase, 0);
      if (pos.baseMissing || !Number.isFinite(cost)) partial = true;
      const future = pos.asset.type === 'future';
      if (!future && Number.isFinite(cost)) costBasis += cost;

      let cursor = cursors.get(pos.assetKey);
      if (!cursor) {
        cursor = new SeriesCursor(prices.get(pos.assetKey));
        cursors.set(pos.assetKey, cursor);
      }
      let price = cursor.at(date);
      let currency = cursor.currency;
      if (price === undefined) {
        const lt = lastTrade.get(pos.assetKey);
        price = lt?.price;
        currency = lt?.currency;
        partial = true;
      }

      const rate = currency ? fx(currency, baseCurrency, date) : undefined;
      if (price === undefined || rate === undefined) {
        partial = true;
        continue;
      }
      const mv = pos.quantity * price * rate;
      value += future ? (Number.isFinite(cost) ? mv - cost : 0) : mv;
    }

    out.push({
      date,
      value,
      costBasis,
      invested,
      benchmark: bench && !benchMissing && benchBase !== undefined ? benchUnits * benchBase : undefined,
      partial,
    });
  }

  return out;
}
