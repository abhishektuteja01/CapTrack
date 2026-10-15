// src/lib/domain/portfolio/positions.ts
// Pure domain logic: derive current positions from a trade stream.
// No Supabase/Next imports here.

import type { Split } from './splits';

export type AssetType = 'stock' | 'etf' | 'mutual_fund' | 'crypto' | 'cash' | string;
export type TradeSide = 'BUY' | 'SELL';

export type TradeLike = {
  id?: string;
  occurredAt: string; // ISO string
  asset: {
    symbol: string;
    type: AssetType;
  };
  side: TradeSide;
  quantity: number;
  price: number;
  fees?: number;
  currency?: string;
  /**
   * Optional rate the broker actually used: 1 unit of `currency` = `fxRate` units of `fxQuote`.
   * Only used when `fxQuote` matches the base currency.
   */
  fxRate?: number | null;
  fxQuote?: string | null;
};

/**
 * Converts 1 unit of `from` into `to` on `date` (YYYY-MM-DD).
 * Returns undefined when no rate is known.
 */
export type FxLookup = (from: string, to: string, date: string) => number | undefined;

export type Position = {
  asset: {
    symbol: string;
    type: AssetType;
  };
  currency?: string;

  // current holdings
  quantity: number;

  // average cost per unit for remaining units (avg-cost method)
  avgCost: number;

  // total cost basis for remaining units
  costBasis: number;

  // total fees paid (for informational display)
  totalFees: number;

  /** Realized P&L from sells, net of sell fees, in the trade currency. */
  realized: number;

  /** Cost basis in the base currency, at trade-date FX. Undefined if any rate was missing. */
  costBasisBase?: number;

  /** Realized P&L in the base currency, at trade-date FX. Undefined if any rate was missing. */
  realizedBase?: number;

  /** True when quantity is zero (fully sold). */
  closed: boolean;

  /** True when trades for this asset used more than one currency. Native figures are then unreliable. */
  mixedCurrency: boolean;

  firstTradeAt: string;
  lastTradeAt: string;
  tradeCount: number;

  /** Splits applied to this holding, oldest first. */
  splits: Split[];
};

export type DerivePositionsOptions = {
  /**
   * How to handle sells that exceed current quantity.
   * - 'clamp': never let quantity go negative; clamp sell to available qty
   * - 'allow_negative': permit negative holdings (not recommended for v1)
   */
  sellBehavior?: 'clamp' | 'allow_negative';

  /** Treat missing fees as 0. */
  defaultFees?: number;

  /** Base currency for the *Base fields. Requires `fx` for non-base trades. */
  baseCurrency?: string;
  fx?: FxLookup;

  /** Keep fully sold positions in the result (marked `closed`). Default false. */
  includeClosed?: boolean;

  /** Splits per `assetKey`, ascending. Applied before any trade on or after the split date. */
  splits?: Map<string, Split[]>;

  /** Apply splits up to this date (YYYY-MM-DD). Default: all of them. */
  asOf?: string;
};

export function assetKey(symbol: string, type: AssetType) {
  return `${type}::${symbol.toUpperCase().trim()}`;
}

function safeNumber(n: unknown, fallback = 0) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function tradeDate(t: Pick<TradeLike, 'occurredAt'>) {
  return new Date(t.occurredAt).toISOString().slice(0, 10);
}

export function sortTrades<T extends Pick<TradeLike, 'occurredAt'>>(trades: T[]): T[] {
  return [...trades].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
}

/** Rate that converts 1 unit of the trade currency into the base currency on the trade date. */
export function tradeRateToBase(
  t: TradeLike,
  baseCurrency: string | undefined,
  fx: FxLookup | undefined
): number | undefined {
  if (!baseCurrency) return undefined;
  const ccy = (t.currency ?? baseCurrency).toUpperCase();
  const base = baseCurrency.toUpperCase();
  if (ccy === base) return 1;
  if (t.fxRate && t.fxRate > 0 && t.fxQuote?.toUpperCase() === base) return t.fxRate;
  return fx?.(ccy, base, tradeDate(t));
}

type LedgerEntry = Position & { baseMissing: boolean };

export type Ledger = Map<string, LedgerEntry>;

export type ApplyOptions = Pick<DerivePositionsOptions, 'sellBehavior' | 'defaultFees'>;

/**
 * Apply one trade to a running ledger (avg-cost method).
 * `rateToBase` converts the trade currency into the base currency (undefined = unknown).
 *
 * - BUY: qty += q; cost += q*price + fees
 * - SELL: cost -= soldQty * avgCost; realized += soldQty*price - fees - soldQty*avgCost
 */
export function applyTrade(
  ledger: Ledger,
  t: TradeLike,
  rateToBase: number | undefined,
  opts: ApplyOptions = {}
) {
  const sellBehavior = opts.sellBehavior ?? 'clamp';
  const symbol = t.asset.symbol.toUpperCase().trim();
  const type = t.asset.type;
  const key = assetKey(symbol, type);

  const qty = safeNumber(t.quantity);
  const price = safeNumber(t.price);
  const fees = safeNumber(t.fees, opts.defaultFees ?? 0);

  if (!symbol || qty <= 0 || price < 0) return;

  const existing = ledger.get(key);
  const pos: LedgerEntry = existing ?? {
    asset: { symbol, type },
    currency: t.currency,
    quantity: 0,
    avgCost: 0,
    costBasis: 0,
    totalFees: 0,
    realized: 0,
    costBasisBase: 0,
    realizedBase: 0,
    closed: false,
    mixedCurrency: false,
    firstTradeAt: t.occurredAt,
    lastTradeAt: t.occurredAt,
    tradeCount: 0,
    splits: [],
    baseMissing: false,
  };

  // preserve first-seen currency (or keep existing)
  if (!pos.currency && t.currency) pos.currency = t.currency;
  if (pos.currency && t.currency && pos.currency.toUpperCase() !== t.currency.toUpperCase()) {
    pos.mixedCurrency = true;
  }
  if (rateToBase === undefined) pos.baseMissing = true;
  const rate = rateToBase ?? 0;

  if (t.side === 'BUY') {
    pos.quantity += qty;
    pos.costBasis += qty * price + fees;
    pos.costBasisBase = (pos.costBasisBase ?? 0) + (qty * price + fees) * rate;
    pos.totalFees += fees;
  } else {
    const currentQty = pos.quantity;
    const sellQty =
      sellBehavior === 'allow_negative' ? qty : Math.min(qty, Math.max(0, currentQty));

    const avgCost = currentQty > 0 ? pos.costBasis / currentQty : 0;
    const avgCostBase = currentQty > 0 ? (pos.costBasisBase ?? 0) / currentQty : 0;
    const removed = Math.min(pos.costBasis, sellQty * avgCost);
    const removedBase = Math.min(pos.costBasisBase ?? 0, sellQty * avgCostBase);

    pos.quantity = currentQty - sellQty;
    pos.costBasis = Math.max(0, pos.costBasis - removed);
    pos.costBasisBase = Math.max(0, (pos.costBasisBase ?? 0) - removedBase);
    pos.realized += sellQty * price - fees - removed;
    pos.realizedBase = (pos.realizedBase ?? 0) + (sellQty * price - fees) * rate - removedBase;
    pos.totalFees += fees;

    // If we allowed negative and went below zero, costBasis should be 0 (no long lots remaining)
    if (sellBehavior === 'allow_negative' && pos.quantity < 0) {
      pos.costBasis = 0;
      pos.costBasisBase = 0;
    }
  }

  pos.avgCost = pos.quantity > 0 ? pos.costBasis / pos.quantity : 0;
  pos.closed = pos.quantity === 0;
  pos.lastTradeAt = t.occurredAt;
  pos.tradeCount += 1;

  ledger.set(key, pos);
}

/**
 * Apply a split to a held asset: quantity × ratio, per-unit cost ÷ ratio. Totals don't change.
 * No-op when the asset isn't held yet.
 */
export function applySplit(ledger: Ledger, key: string, split: Split) {
  const pos = ledger.get(key);
  if (!pos || pos.quantity === 0 || !(split.ratio > 0)) return;
  pos.quantity *= split.ratio;
  pos.avgCost = pos.quantity > 0 ? pos.costBasis / pos.quantity : 0;
  pos.splits = [...pos.splits, split];
}

/** Applies each asset's splits in date order as the replay moves forward. */
export class SplitCursor {
  private next = new Map<string, number>();
  constructor(private splits: Map<string, Split[]> = new Map()) {}

  /** Apply every split for `key` dated on or before `date` that hasn't been applied yet. */
  advance(ledger: Ledger, key: string, date: string) {
    const list = this.splits.get(key);
    if (!list) return;
    let i = this.next.get(key) ?? 0;
    while (i < list.length && list[i].date <= date) applySplit(ledger, key, list[i++]);
    this.next.set(key, i);
  }

  advanceAll(ledger: Ledger, date: string) {
    for (const key of this.splits.keys()) this.advance(ledger, key, date);
  }
}

function toPosition(entry: LedgerEntry, hasBase: boolean): Position {
  const { baseMissing, ...pos } = entry;
  if (!hasBase || baseMissing) {
    return { ...pos, costBasisBase: undefined, realizedBase: undefined };
  }
  return pos;
}

/**
 * Derive positions using an average-cost method.
 *
 * Rules:
 * - BUY increases qty and cost basis by (qty * price + fees)
 * - SELL decreases qty and reduces cost basis by (soldQty * currentAvgCost),
 *   and books realized P&L of (soldQty * price - sellFees - removedCost)
 * - With `baseCurrency` + `fx`, every amount is also tracked in the base currency
 *   at the trade-date rate (or the trade's own `fxRate` override).
 * - `splits` multiply quantity (and divide per-unit cost) for holdings existing before each split date.
 */
export function derivePositions(
  trades: TradeLike[],
  opts: DerivePositionsOptions = {}
): Position[] {
  const ledger: Ledger = new Map();
  const splits = new SplitCursor(opts.splits);

  for (const t of sortTrades(trades)) {
    splits.advance(ledger, assetKey(t.asset.symbol, t.asset.type), tradeDate(t));
    applyTrade(ledger, t, tradeRateToBase(t, opts.baseCurrency, opts.fx), opts);
  }
  splits.advanceAll(ledger, opts.asOf ?? '9999-12-31');

  const hasBase = Boolean(opts.baseCurrency);

  // return stable ordering: by type then symbol
  return Array.from(ledger.values())
    .filter((p) => (opts.includeClosed ? true : p.quantity !== 0))
    .map((p) => toPosition(p, hasBase))
    .sort((a, b) => {
      if (a.asset.type === b.asset.type) return a.asset.symbol.localeCompare(b.asset.symbol);
      return String(a.asset.type).localeCompare(String(b.asset.type));
    });
}

/** Convenience helper for quickly looking up a single asset's position. */
export function getPositionForAsset(
  positions: Position[],
  asset: { symbol: string; type: AssetType }
): Position | undefined {
  const key = assetKey(asset.symbol, asset.type);
  return positions.find((p) => assetKey(p.asset.symbol, p.asset.type) === key);
}
