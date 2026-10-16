// src/lib/domain/portfolio/positions.ts
// Pure domain logic: replay a trade stream into lots, positions and realized P&L.
// No Supabase/Next imports here.
//
// Every holding is a list of lots, kept per platform (account). Sells close lots first-in-first-out.
// With the average method, every open lot of a holding carries the pooled average cost, so the
// cost matches average-cost accounting while dates still follow FIFO (for holding periods).
// Futures and options may go short: a sell with nothing to close opens a short lot.

import type { Split } from './splits';

export type AssetType = 'stock' | 'etf' | 'mutual_fund' | 'crypto' | 'future' | 'option' | 'other' | string;
export type TradeSide = 'BUY' | 'SELL';
export type CostMethod = 'fifo' | 'average';

/** NSE futures and options contract details. Quantity and price are per unit (lots × lot size). */
export type Contract = {
  underlying: string;
  expiry: string; // YYYY-MM-DD
  strike?: number;
  optionType?: 'CE' | 'PE';
  lotSize?: number;
};

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
  /** Account the trade happened in. Lots never move between platforms. Default 'Manual'. */
  platform?: string;
  contract?: Contract | null;
};

/**
 * Converts 1 unit of `from` into `to` on `date` (YYYY-MM-DD).
 * Returns undefined when no rate is known.
 */
export type FxLookup = (from: string, to: string, date: string) => number | undefined;

export type Lot = {
  tradeId?: string;
  openedAt: string; // ISO
  /** Signed: positive for long, negative for short. */
  qty: number;
  /** Per unit, trade currency, fees included (buy: price + fees; short: price − fees). */
  unitCost: number;
  /** Same in the base currency at the opening date's rate. NaN when the rate was unknown. */
  unitCostBase: number;
};

/** One closed slice of a lot. A sell that closes three lots makes three of these. */
export type Realization = {
  /** Closing trade, or undefined for an expiry settlement. */
  tradeId?: string;
  openTradeId?: string;
  key: string;
  assetKey: string;
  symbol: string;
  type: AssetType;
  platform: string;
  currency?: string;
  openedAt: string;
  closedAt: string;
  quantity: number; // always positive
  direction: 'long' | 'short';
  /** What the units cost to open (long) or to close (short), fees included. Trade currency. */
  cost: number;
  /** What the units brought in, fees deducted. Trade currency. */
  proceeds: number;
  pnl: number;
  costBase?: number;
  proceedsBase?: number;
  pnlBase?: number;
  settled?: boolean;
};

export type Position = {
  /** platform + asset */
  key: string;
  assetKey: string;
  asset: { symbol: string; type: AssetType };
  platform: string;
  currency?: string;
  contract?: Contract;

  /** Signed: negative for a short futures or options position. */
  quantity: number;
  lots: Lot[];

  /** Per unit cost of what's open (sign-free). */
  avgCost: number;
  /** Signed total: qty × unit cost summed over open lots (negative for shorts). */
  costBasis: number;
  /** Total fees paid on every trade. */
  totalFees: number;
  /** Realized P&L from closes, fees included, in the trade currency. */
  realized: number;

  /** Cost basis in the base currency, at opening-date FX. Undefined if any rate was missing. */
  costBasisBase?: number;
  /** Realized P&L in the base currency. Undefined if any rate was missing. */
  realizedBase?: number;

  /** True when quantity is zero. */
  closed: boolean;
  /** True when trades for this asset used more than one currency. Native figures are then unreliable. */
  mixedCurrency: boolean;
  /** Units a sell tried to close beyond what was held (stocks can't go short). */
  oversold: number;
  /** A futures or options contract past expiry with no settlement price yet. */
  unsettled: boolean;

  firstTradeAt: string;
  lastTradeAt: string;
  tradeCount: number;

  /** Splits applied to this holding, oldest first. */
  splits: Split[];
};

export type DerivePositionsOptions = {
  method?: CostMethod;

  /** Treat missing fees as 0. */
  defaultFees?: number;

  /** Base currency for the *Base fields. Requires `fx` for non-base trades. */
  baseCurrency?: string;
  fx?: FxLookup;

  /** Keep fully closed positions in the result (marked `closed`). Default false. */
  includeClosed?: boolean;

  /** Splits per `assetKey`, ascending. Applied before any trade on or after the split date. */
  splits?: Map<string, Split[]>;

  /** Replay up to this date (YYYY-MM-DD): later trades are ignored. Default: everything. */
  asOf?: string;

  /**
   * Final settlement price of an expired futures or options contract (per unit, trade currency).
   * Expired contracts with an answer are closed at that price on their expiry date.
   */
  settlement?: (symbol: string, contract: Contract) => number | undefined;
};

export function assetKey(symbol: string, type: AssetType) {
  return `${type}::${symbol.toUpperCase().trim()}`;
}

export function accountKey(platform: string | undefined, symbol: string, type: AssetType) {
  return `${platformName(platform)}||${assetKey(symbol, type)}`;
}

export function platformName(p: string | null | undefined) {
  return p?.trim() || 'Manual';
}

export function isDerivative(type: AssetType) {
  return type === 'future' || type === 'option';
}

function safeNumber(n: unknown, fallback = 0) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function tradeDate(t: Pick<TradeLike, 'occurredAt'>) {
  return new Date(t.occurredAt).toISOString().slice(0, 10);
}

export function sortTrades<T extends Pick<TradeLike, 'occurredAt'>>(trades: T[]): T[] {
  return [...trades].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

/** Rate that converts 1 unit of the trade currency into the base currency on the trade date. */
export function tradeRateToBase(
  t: Pick<TradeLike, 'currency' | 'fxRate' | 'fxQuote' | 'occurredAt'>,
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

type LedgerEntry = Omit<Position, 'costBasis' | 'costBasisBase' | 'avgCost' | 'realizedBase' | 'closed'> & {
  realizedBase: number;
  baseMissing: boolean;
};

export type Ledger = Map<string, LedgerEntry>;

/** What one trade did to cash and P&L. */
export type TradeEffect = {
  realizations: Realization[];
  /** Cash in (+) or out (−) in the trade currency. Futures only move cash by their realized P&L. */
  cash: number;
  /** Same in the base currency; undefined when the rate was unknown. */
  cashBase?: number;
};

const EPS = 1e-9;

function sum(lots: Lot[], f: (l: Lot) => number) {
  return lots.reduce((s, l) => s + f(l), 0);
}

/** Pool every open lot's cost into one average (average-cost method). */
function averageLots(lots: Lot[]) {
  if (lots.length < 2) return;
  const qty = sum(lots, (l) => l.qty);
  if (Math.abs(qty) < EPS) return;
  const unit = sum(lots, (l) => l.qty * l.unitCost) / qty;
  const unitBase = sum(lots, (l) => l.qty * l.unitCostBase) / qty;
  for (const l of lots) {
    l.unitCost = unit;
    l.unitCostBase = unitBase;
  }
}

function newEntry(t: TradeLike, key: string): LedgerEntry {
  const symbol = t.asset.symbol.toUpperCase().trim();
  return {
    key,
    assetKey: assetKey(symbol, t.asset.type),
    asset: { symbol, type: t.asset.type },
    platform: platformName(t.platform),
    currency: t.currency,
    contract: t.contract ?? undefined,
    quantity: 0,
    lots: [],
    totalFees: 0,
    realized: 0,
    realizedBase: 0,
    baseMissing: false,
    mixedCurrency: false,
    oversold: 0,
    unsettled: false,
    firstTradeAt: t.occurredAt,
    lastTradeAt: t.occurredAt,
    tradeCount: 0,
    splits: [],
  };
}

/**
 * Apply one trade to a running ledger.
 * `rateToBase` converts the trade currency into the base currency (undefined = unknown).
 */
export function applyTrade(
  ledger: Ledger,
  t: TradeLike,
  rateToBase: number | undefined,
  opts: Pick<DerivePositionsOptions, 'method' | 'defaultFees'> & { settled?: boolean } = {}
): TradeEffect {
  const symbol = t.asset.symbol.toUpperCase().trim();
  const qty = safeNumber(t.quantity);
  const price = safeNumber(t.price);
  const fees = safeNumber(t.fees, opts.defaultFees ?? 0);
  const none: TradeEffect = { realizations: [], cash: 0, cashBase: 0 };
  if (!symbol || qty <= 0 || price < 0) return none;

  const key = accountKey(t.platform, symbol, t.asset.type);
  const pos = ledger.get(key) ?? newEntry(t, key);
  if (!pos.currency && t.currency) pos.currency = t.currency;
  if (pos.currency && t.currency && pos.currency.toUpperCase() !== t.currency.toUpperCase()) pos.mixedCurrency = true;
  if (t.contract && !pos.contract) pos.contract = t.contract;
  if (rateToBase === undefined) pos.baseMissing = true;
  const rate = rateToBase ?? NaN;

  const dir = t.side === 'BUY' ? 1 : -1;
  const derivative = isDerivative(t.asset.type);
  const feePerUnit = fees / qty;
  const realizations: Realization[] = [];

  // 1. Close lots on the other side, oldest first.
  let left = qty;
  while (left > EPS && pos.lots.length && Math.sign(pos.lots[0].qty) === -dir) {
    const lot = pos.lots[0];
    const take = Math.min(left, Math.abs(lot.qty));
    const long = lot.qty > 0;
    // long: sold at price − fee; short: bought back at price + fee
    const exitUnit = long ? price - feePerUnit : price + feePerUnit;
    const cost = long ? take * lot.unitCost : take * exitUnit;
    const proceeds = long ? take * exitUnit : take * lot.unitCost;
    const costBase = long ? take * lot.unitCostBase : take * exitUnit * rate;
    const proceedsBase = long ? take * exitUnit * rate : take * lot.unitCostBase;
    realizations.push({
      tradeId: opts.settled ? undefined : t.id,
      openTradeId: lot.tradeId,
      key,
      assetKey: pos.assetKey,
      symbol: pos.asset.symbol,
      type: pos.asset.type,
      platform: pos.platform,
      currency: pos.currency,
      openedAt: lot.openedAt,
      closedAt: t.occurredAt,
      quantity: take,
      direction: long ? 'long' : 'short',
      cost,
      proceeds,
      pnl: proceeds - cost,
      costBase,
      proceedsBase,
      pnlBase: proceedsBase - costBase,
      settled: opts.settled || undefined,
    });
    lot.qty -= take * Math.sign(lot.qty);
    if (Math.abs(lot.qty) < EPS) pos.lots.shift();
    left -= take;
  }

  // 2. Whatever is left opens a lot (or is dropped: stocks can't go short).
  if (left > EPS) {
    if (dir < 0 && !derivative) {
      pos.oversold += left;
    } else {
      const unitCost = price + dir * feePerUnit;
      pos.lots.push({
        tradeId: t.id,
        openedAt: t.occurredAt,
        qty: dir * left,
        unitCost,
        unitCostBase: unitCost * rate,
      });
      if (opts.method === 'average') averageLots(pos.lots);
    }
  }

  const realized = realizations.reduce((s, r) => s + r.pnl, 0);
  const realizedBase = realizations.reduce((s, r) => s + (r.pnlBase ?? 0), 0);
  pos.realized += realized;
  pos.realizedBase += realizedBase;
  pos.totalFees += fees;
  pos.quantity = sum(pos.lots, (l) => l.qty);
  if (!opts.settled) {
    pos.lastTradeAt = t.occurredAt;
    pos.tradeCount += 1;
  }
  ledger.set(key, pos);

  // Cash: futures settle P&L only; everything else pays or receives the full amount.
  // The clamped part of an oversell never happened, so it moves no cash.
  let cash: number;
  let cashBase: number | undefined;
  if (t.asset.type === 'future') {
    cash = realized;
    cashBase = realizedBase;
  } else {
    const units = dir < 0 && !derivative ? qty - Math.max(0, left) : qty;
    const unitsFees = qty > 0 ? (fees * units) / qty : 0;
    cash = dir > 0 ? -(units * price + unitsFees) : units * price - unitsFees;
    cashBase = cash * rate;
  }
  return { realizations, cash, cashBase: Number.isNaN(cashBase) ? undefined : cashBase };
}

/**
 * Apply a split to every account holding an asset: quantity × ratio, per-unit cost ÷ ratio.
 * Totals don't change.
 */
export function applySplit(ledger: Ledger, asset: string, split: Split) {
  if (!(split.ratio > 0)) return;
  for (const pos of ledger.values()) {
    if (pos.assetKey !== asset || !pos.lots.length) continue;
    for (const l of pos.lots) {
      l.qty *= split.ratio;
      l.unitCost /= split.ratio;
      l.unitCostBase /= split.ratio;
    }
    pos.quantity = sum(pos.lots, (l) => l.qty);
    pos.splits = [...pos.splits, split];
  }
}

/** Applies each asset's splits in date order as the replay moves forward. */
export class SplitCursor {
  private next = new Map<string, number>();
  constructor(private splits: Map<string, Split[]> = new Map()) {}

  /** Apply every split for `asset` dated on or before `date` that hasn't been applied yet. */
  advance(ledger: Ledger, asset: string, date: string) {
    const list = this.splits.get(asset);
    if (!list) return;
    let i = this.next.get(asset) ?? 0;
    while (i < list.length && list[i].date <= date) applySplit(ledger, asset, list[i++]);
    this.next.set(asset, i);
  }

  advanceAll(ledger: Ledger, date: string) {
    for (const asset of this.splits.keys()) this.advance(ledger, asset, date);
  }
}

/**
 * Close every open futures or options contract that expired before `date` (or on it when `inclusive`),
 * at its settlement price. Contracts without a price stay open and are marked `unsettled`.
 */
export function settleExpired(
  ledger: Ledger,
  date: string,
  inclusive: boolean,
  baseCurrency: string | undefined,
  fx: FxLookup | undefined,
  settlement: DerivePositionsOptions['settlement'],
  method?: CostMethod
): TradeEffect[] {
  const out: TradeEffect[] = [];
  for (const pos of ledger.values()) {
    const c = pos.contract;
    if (!c || !pos.lots.length) continue;
    if (inclusive ? c.expiry > date : c.expiry >= date) continue;
    const price = settlement?.(pos.asset.symbol, c);
    if (price === undefined) {
      if (c.expiry < date) pos.unsettled = true;
      continue;
    }
    pos.unsettled = false;
    const t: TradeLike = {
      occurredAt: `${c.expiry}T23:59:59.000Z`,
      asset: pos.asset,
      side: pos.quantity > 0 ? 'SELL' : 'BUY',
      quantity: Math.abs(pos.quantity),
      price,
      fees: 0,
      currency: pos.currency,
      platform: pos.platform,
      contract: c,
    };
    out.push(applyTrade(ledger, t, tradeRateToBase(t, baseCurrency, fx), { method, settled: true }));
  }
  return out;
}

function toPosition(entry: LedgerEntry, hasBase: boolean): Position {
  const { baseMissing, ...rest } = entry;
  const costBasis = sum(entry.lots, (l) => l.qty * l.unitCost);
  const costBasisBase = sum(entry.lots, (l) => l.qty * l.unitCostBase);
  const qty = entry.quantity;
  const base = hasBase && !baseMissing && Number.isFinite(costBasisBase);
  return {
    ...rest,
    lots: entry.lots.map((l) => ({ ...l })),
    quantity: Math.abs(qty) < EPS ? 0 : qty,
    costBasis,
    avgCost: Math.abs(qty) > EPS ? costBasis / qty : 0,
    costBasisBase: base ? costBasisBase : undefined,
    realizedBase: base ? entry.realizedBase : undefined,
    closed: Math.abs(qty) < EPS,
  };
}

export type Replay = {
  positions: Position[];
  realizations: Realization[];
  /** Cash effect of every trade and settlement, in order. */
  flows: TradeFlow[];
};

/** Cash a trade moved. `settleCurrency`/`settleAmount` are what left the account (the broker's FX rate applied). */
export type TradeFlow = {
  date: string;
  tradeId?: string;
  platform: string;
  type: AssetType;
  cash: number;
  cashBase?: number;
  currency?: string;
  settleCurrency?: string;
  settleAmount: number;
  settled?: boolean;
};

/**
 * Replay trades into positions, realized slices and cash flows.
 * - FIFO by default; `method: 'average'` pools cost.
 * - With `baseCurrency` + `fx`, every amount is also tracked in the base currency at the
 *   trade-date rate (or the trade's own `fxRate` override).
 * - `splits` multiply quantity (and divide per-unit cost) for lots open before each split date.
 */
export function replay(trades: TradeLike[], opts: DerivePositionsOptions = {}): Replay {
  const ledger: Ledger = new Map();
  const splits = new SplitCursor(opts.splits);
  const realizations: Realization[] = [];
  const flows: Replay['flows'] = [];
  const end = opts.asOf ?? '9999-12-31';

  const record = (
    e: TradeEffect,
    t: Pick<TradeLike, 'occurredAt' | 'id' | 'platform' | 'asset' | 'currency' | 'fxRate' | 'fxQuote'>,
    settled?: boolean
  ) => {
    realizations.push(...e.realizations);
    const converted = Boolean(t.fxRate && t.fxRate > 0 && t.fxQuote);
    flows.push({
      date: tradeDate(t),
      tradeId: t.id,
      platform: platformName(t.platform),
      type: t.asset.type,
      cash: e.cash,
      cashBase: e.cashBase,
      currency: t.currency,
      settleCurrency: converted ? t.fxQuote!.toUpperCase() : t.currency?.toUpperCase(),
      settleAmount: converted ? e.cash * t.fxRate! : e.cash,
      settled,
    });
  };
  const settle = (date: string, inclusive: boolean) => {
    for (const e of settleExpired(ledger, date, inclusive, opts.baseCurrency, opts.fx, opts.settlement, opts.method)) {
      const r = e.realizations[0];
      const p = r ? ledger.get(r.key) : undefined;
      if (r && p) record(e, { occurredAt: r.closedAt, platform: p.platform, asset: p.asset, currency: p.currency }, true);
    }
  };

  for (const t of sortTrades(trades)) {
    const date = tradeDate(t);
    if (date > end) break;
    settle(date, false);
    splits.advance(ledger, assetKey(t.asset.symbol, t.asset.type), date);
    record(applyTrade(ledger, t, tradeRateToBase(t, opts.baseCurrency, opts.fx), opts), t);
  }
  splits.advanceAll(ledger, end);
  settle(end, opts.asOf !== undefined);

  const hasBase = Boolean(opts.baseCurrency);
  const positions = Array.from(ledger.values())
    .map((p) => toPosition(p, hasBase))
    .filter((p) => opts.includeClosed || !p.closed)
    .sort((a, b) => a.key.localeCompare(b.key));
  return { positions, realizations, flows };
}

/** Positions only. See `replay`. */
export function derivePositions(trades: TradeLike[], opts: DerivePositionsOptions = {}): Position[] {
  return replay(trades, opts).positions;
}

/** Units of one asset held on one platform at the end of `date`, after splits. */
export function heldOn(
  trades: TradeLike[],
  asset: { symbol: string; type: AssetType },
  platform: string | undefined,
  date: string,
  splits?: Map<string, Split[]>
): number {
  const key = assetKey(asset.symbol, asset.type);
  const mine = trades.filter(
    (t) => assetKey(t.asset.symbol, t.asset.type) === key && (platform === undefined || platformName(t.platform) === platformName(platform))
  );
  return replay(mine, { asOf: date, splits, includeClosed: true }).positions.reduce((s, p) => s + p.quantity, 0);
}

/** Convenience helper for quickly looking up a single asset's position. */
export function getPositionForAsset(
  positions: Position[],
  asset: { symbol: string; type: AssetType }
): Position | undefined {
  const key = assetKey(asset.symbol, asset.type);
  return positions.find((p) => p.assetKey === key);
}
