// src/lib/portfolio.ts
// Assembles everything the app shows: holdings, F&O, cash, money in and out, returns, history and
// realized sales, all in the user's base currency. `assemble` is pure (the landing page's example
// portfolio uses it too); `loadPortfolio` fetches the inputs for the signed-in user. Server only.

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assetKey,
  isDerivative,
  platformName,
  replay,
  tradeDate,
  type Contract,
  type CostMethod,
  type Position,
  type Replay,
  type TradeLike,
} from '@/lib/domain/portfolio/positions';
import { buildHistory, closeOn, type HistoryPoint, type PriceSeries } from '@/lib/domain/portfolio/history';
import { xirr } from '@/lib/domain/portfolio/xirr';
import type { Split } from '@/lib/domain/portfolio/splits';
import { makeFxLookup, type UsdRateRow } from '@/lib/domain/fx/rates';
import { cashBalances, cashSign, summarizeMoney, xirrFlows, type CashEntryLike, type CashKind, type MoneySummary } from '@/lib/domain/portfolio/money';
import { saleRows, type SaleRow } from '@/lib/domain/portfolio/tax';
import { missingDividends, type DividendEvent, type DividendSuggestion } from '@/lib/domain/portfolio/dividends';
import { intrinsicValue } from '@/lib/domain/portfolio/contracts';
import { isoDate, loadFx, loadMarket, sourceId, sourceName, type MarketAsset } from '@/lib/services/market/store';
import { fetchQuotes, type Quote } from '@/lib/services/prices/quotes';
import { normalizePlatforms } from '@/lib/settings';

// ---------- Rows ----------

export type TradeRow = {
  id: string;
  occurred_at: string;
  asset_symbol: string;
  asset_type: string;
  asset_name?: string | null;
  side: 'BUY' | 'SELL';
  quantity: number | string;
  price: number | string;
  fees: number | string | null;
  currency: string;
  platform: string | null;
  notes?: string | null;
  fx_rate?: number | string | null;
  fx_quote?: string | null;
  external_id?: string | null;
  underlying?: string | null;
  expiry?: string | null;
  strike?: number | string | null;
  option_type?: string | null;
  lot_size?: number | string | null;
};

export type CashRow = {
  id: string;
  occurred_at: string;
  kind: CashKind;
  amount: number | string;
  currency: string;
  platform: string | null;
  asset_symbol: string | null;
  asset_type: string | null;
  notes: string | null;
  external_id?: string | null;
};

export type AppTrade = TradeLike & { id: string; platform: string; name?: string; notes?: string | null; externalId?: string | null };
export type AppCash = CashEntryLike & { id: string; platform: string; notes?: string | null; externalId?: string | null };

export function toContract(t: Pick<TradeRow, 'underlying' | 'expiry' | 'strike' | 'option_type' | 'lot_size'>): Contract | null {
  if (!t.underlying || !t.expiry) return null;
  return {
    underlying: t.underlying,
    expiry: String(t.expiry).slice(0, 10),
    strike: t.strike == null ? undefined : Number(t.strike),
    optionType: t.option_type === 'CE' || t.option_type === 'PE' ? t.option_type : undefined,
    lotSize: t.lot_size == null ? undefined : Number(t.lot_size),
  };
}

export function toTradeLike(t: TradeRow): AppTrade {
  return {
    id: t.id,
    occurredAt: t.occurred_at,
    asset: { symbol: t.asset_symbol, type: t.asset_type },
    name: t.asset_name ?? undefined,
    side: t.side,
    quantity: Number(t.quantity),
    price: Number(t.price),
    fees: Number(t.fees ?? 0),
    currency: (t.currency ?? '').trim().toUpperCase() || undefined,
    fxRate: t.fx_rate == null ? null : Number(t.fx_rate),
    fxQuote: t.fx_quote ?? null,
    platform: platformName(t.platform),
    contract: isDerivative(t.asset_type) ? toContract(t) : null,
    notes: t.notes,
    externalId: t.external_id,
  };
}

export function toCashLike(c: CashRow): AppCash {
  return {
    id: c.id,
    occurredAt: c.occurred_at,
    kind: c.kind,
    amount: Number(c.amount),
    currency: c.currency.toUpperCase(),
    platform: platformName(c.platform),
    assetSymbol: c.asset_symbol,
    assetType: c.asset_type,
    notes: c.notes,
    externalId: c.external_id,
  };
}

// ---------- Snapshot ----------

export type Account = { platform: string; quantity: number; avgCost: number };

export type Holding = {
  key: string;
  symbol: string;
  type: string;
  name?: string;
  exchange?: string;
  platforms: string[];
  /** Per-platform quantity and cost, for selling from the right account. */
  accounts: Account[];
  /** Currency the trades were entered in. */
  tradeCurrency?: string;
  /** Currency the price is quoted in (major unit). */
  quoteCurrency?: string;
  /** Signed: negative for short F&O positions. */
  quantity: number;
  avgCost: number; // trade currency
  price?: number; // quote currency
  /** live: Yahoo quote; nav: latest fund NAV; eod: last NSE settlement; trade: last trade price. */
  priceSource?: 'live' | 'nav' | 'eod' | 'trade';
  priceDate?: string;
  previousClose?: number;
  dayChangePct?: number;
  dayChangeBase?: number;
  /** Market value; for futures, the open P&L (they have no value of their own). */
  valueBase?: number;
  costBasisBase?: number;
  unrealizedBase?: number;
  unrealizedPct?: number;
  realizedBase?: number;
  incomeBase?: number;
  weight?: number; // % of total holdings value
  intraday: number[];
  firstTradeAt: string;
  mixedCurrency: boolean;
  splits: Split[];
  contract?: Contract;
  /** Contract past expiry with no settlement price yet. */
  unsettled?: boolean;
  /** Units sold beyond what the log shows were bought. */
  oversold?: number;
  missing?: 'quote' | 'fx';
};

export type ClosedHolding = {
  key: string;
  symbol: string;
  type: string;
  platforms: string[];
  tradeCurrency?: string;
  /** Paid in and taken out over the holding's life, base currency. */
  boughtBase?: number;
  soldBase?: number;
  realizedBase?: number;
  incomeBase?: number;
  returnPct?: number;
  firstTradeAt: string;
  lastTradeAt: string;
};

export type Slice = { key: string; value: number; weight: number };
export type CashLine = { platform: string; currency: string; amount: number; valueBase?: number };

export type PortfolioSettings = {
  costMethod: CostMethod;
  fyStartMonth: number;
  longTermMonths: number;
  benchmark: string | null;
};

export type PortfolioSnapshot = {
  baseCurrency: string;
  platforms: string[];
  settings: PortfolioSettings;
  tradeCount: number;
  cashCount: number;
  holdings: Holding[];
  derivatives: Holding[];
  closed: ClosedHolding[];
  cash: CashLine[];
  totals: {
    /** Holdings, F&O and tracked cash. */
    value?: number;
    holdingsValue?: number;
    cashValue?: number;
    /** Cost of what's held now. */
    costBasis?: number;
    unrealized?: number;
    unrealizedPct?: number;
    realized?: number;
    income?: number;
    charges?: number;
    /** Unrealized + realized + income − charges. */
    totalReturn?: number;
    /** Total return ÷ money put in. */
    totalReturnPct?: number;
    dayChange?: number;
    dayChangePct?: number;
    xirr?: number; // percent
    benchmarkValue?: number;
    benchmarkXirr?: number;
  };
  money: MoneySummary;
  allocation: { platform: Slice[]; currency: Slice[]; type: Slice[] };
  history: HistoryPoint[];
  /** Latest quote time (ms) across holdings. */
  pricesAsOf?: number;
  /** True when the latest quote is more than 4 days old. */
  pricesStale: boolean;
  sources: string[];
  /** FX date used for today's conversion, and 1 unit → base for each currency shown. */
  fx: { date: string; rates: { currency: string; toBase: number }[] };
  missingQuotes: string[];
  missingFx: string[];
  /** Dividends reported for held units that aren't logged. */
  unloggedDividends: number;
};

export type PortfolioInput = {
  baseCurrency: string;
  platforms: string[];
  settings: PortfolioSettings;
  trades: AppTrade[];
  cash: AppCash[];
  prices: Map<string, PriceSeries>;
  splits: Map<string, Split[]>;
  dividends: Map<string, { currency: string; events: DividendEvent[] }>;
  fxRows: UsdRateRow[];
  benchmark?: PriceSeries;
  underlyings: Map<string, PriceSeries>;
  quotes: Map<string, Quote>;
  sources: string[];
  today: string;
  withHistory?: boolean;
};

/** Everything derived, for pages that need more than the snapshot. */
export type PortfolioModel = {
  snapshot: PortfolioSnapshot;
  input: PortfolioInput;
  replay: Replay;
  sales: SaleRow[];
  suggestions: DividendSuggestion[];
};

function slices(map: Map<string, number>, total: number): Slice[] {
  return Array.from(map, ([key, value]) => ({ key, value, weight: total ? (value / total) * 100 : 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

function add(map: Map<string, number>, key: string, v: number) {
  map.set(key, (map.get(key) ?? 0) + v);
}

const fin = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : undefined);

const DEFAULT_SETTINGS: PortfolioSettings = { costMethod: 'fifo', fyStartMonth: 1, longTermMonths: 12, benchmark: null };

/** Build the snapshot from loaded inputs. Pure apart from the clock in `input.today`. */
export function assemble(input: PortfolioInput): PortfolioModel {
  const { trades, cash, baseCurrency, today, quotes, prices } = input;
  const fx = makeFxLookup(input.fxRows);
  const method = input.settings.costMethod;

  // Expired contracts settle at NSE's settlement price, else at intrinsic value from the underlying's close.
  const typeOf = new Map(trades.map((t) => [t.asset.symbol.toUpperCase(), t.asset.type]));
  const settlement = (symbol: string, c: Contract) => {
    const type = typeOf.get(symbol.toUpperCase());
    const s = prices.get(assetKey(symbol, type ?? 'option'));
    const exact = s?.points.find((p) => p.date === c.expiry);
    if (exact) return exact.close;
    const u = input.underlyings.get(c.underlying);
    const last = u?.points[u.points.length - 1]?.date;
    if (u && last && last >= c.expiry) {
      const spot = closeOn(u, c.expiry);
      if (spot !== undefined) return intrinsicValue(c, spot, type === 'future' ? 'future' : 'option');
    }
    return undefined;
  };

  const r = replay(trades, { baseCurrency, fx, includeClosed: true, splits: input.splits, method, settlement, asOf: today });
  const money = summarizeMoney({ flows: r.flows, cash, baseCurrency, fx });

  // Income per asset (dividends logged against a symbol).
  const income = new Map<string, number>();
  for (const c of cash) {
    if (c.kind !== 'dividend' || !c.assetSymbol) continue;
    const type = c.assetType || typeOf.get(c.assetSymbol.toUpperCase());
    if (!type) continue;
    const rate = fx(c.currency, baseCurrency, tradeDate(c));
    if (rate !== undefined) add(income, assetKey(c.assetSymbol, type), c.amount * rate);
  }

  // Per-asset trade flows for closed holdings.
  const tradeById = new Map(trades.map((t) => [t.id, t]));
  const flowsByAsset = new Map<string, { in: number; out: number; partial: boolean }>();
  for (const f of r.flows) {
    const t = f.tradeId ? tradeById.get(f.tradeId) : undefined;
    const k = t ? assetKey(t.asset.symbol, t.asset.type) : undefined;
    if (!k) continue;
    const e = flowsByAsset.get(k) ?? { in: 0, out: 0, partial: false };
    if (f.cashBase === undefined) e.partial = true;
    else if (f.cashBase < 0) e.in -= f.cashBase;
    else e.out += f.cashBase;
    flowsByAsset.set(k, e);
  }
  // Settlements carry no trade id; attribute them by realization.
  for (const z of r.realizations) {
    if (!z.settled) continue;
    const e = flowsByAsset.get(z.assetKey) ?? { in: 0, out: 0, partial: false };
    // Futures settle their P&L; a long option receives its value, a short one pays it.
    const v = z.type === 'future' ? z.pnlBase : z.direction === 'long' ? z.proceedsBase : z.costBase === undefined ? undefined : -z.costBase;
    if (v === undefined || Number.isNaN(v)) e.partial = true;
    else if (v < 0) e.in -= v;
    else e.out += v;
    flowsByAsset.set(z.assetKey, e);
  }

  // Merge platform accounts into one row per asset.
  const byAsset = new Map<string, Position[]>();
  for (const p of r.positions) byAsset.set(p.assetKey, [...(byAsset.get(p.assetKey) ?? []), p]);

  const names = new Map<string, string>();
  for (const t of trades) if (t.name) names.set(assetKey(t.asset.symbol, t.asset.type), t.name);

  const missingQuotes: string[] = [];
  const missingFx = new Set<string>();
  const holdings: Holding[] = [];
  const derivatives: Holding[] = [];
  const closed: ClosedHolding[] = [];
  let realized: number | undefined = 0;

  for (const [key, list] of byAsset) {
    const p0 = list[0];
    const open = list.filter((p) => !p.closed);
    let realizedBase: number | undefined = 0;
    for (const p of list) {
      if (p.realizedBase === undefined) {
        realizedBase = undefined;
        if (p.currency) missingFx.add(p.currency);
      } else if (realizedBase !== undefined) realizedBase += p.realizedBase;
    }
    if (realizedBase === undefined) realized = undefined;
    else if (realized !== undefined) realized += realizedBase;
    const incomeBase = income.get(key);
    const platforms = Array.from(new Set(list.map((p) => p.platform)));
    const firstTradeAt = list.reduce((m, p) => (p.firstTradeAt < m ? p.firstTradeAt : m), p0.firstTradeAt);
    const lastTradeAt = list.reduce((m, p) => (p.lastTradeAt > m ? p.lastTradeAt : m), p0.lastTradeAt);

    if (!open.length) {
      const f = flowsByAsset.get(key);
      const ret = realizedBase !== undefined ? realizedBase + (incomeBase ?? 0) : undefined;
      closed.push({
        key,
        symbol: p0.asset.symbol,
        type: String(p0.asset.type),
        platforms,
        tradeCurrency: p0.currency,
        boughtBase: f && !f.partial ? f.in : undefined,
        soldBase: f && !f.partial ? f.out : undefined,
        realizedBase,
        incomeBase,
        returnPct: ret !== undefined && f?.in ? (ret / f.in) * 100 : undefined,
        firstTradeAt,
        lastTradeAt,
      });
      continue;
    }

    const quantity = open.reduce((s, p) => s + p.quantity, 0);
    const costBasis = open.reduce((s, p) => s + p.costBasis, 0);
    const costParts = open.map((p) => p.costBasisBase);
    const costBasisBase = costParts.every((v) => v !== undefined) ? costParts.reduce((s, v) => s + v!, 0) : undefined;
    const type = String(p0.asset.type);
    const future = type === 'future';

    // Price: live quote, else latest stored close (NSE settlement for F&O), else last trade.
    const q = quotes.get(key);
    const series = prices.get(key);
    const lastPt = series?.points[series.points.length - 1];
    const prevPt = series?.points[series.points.length - 2];
    let price: number | undefined;
    let quoteCurrency: string | undefined;
    let previousClose: number | undefined;
    let priceSource: Holding['priceSource'];
    let priceDate: string | undefined;
    if (q) {
      price = q.price;
      quoteCurrency = q.currency;
      previousClose = q.previousClose;
      priceSource = q.source === 'amfi' ? 'nav' : 'live';
      priceDate = isoDate(q.timestamp);
    } else if (lastPt && (isDerivative(type) || type === 'other')) {
      price = lastPt.close;
      quoteCurrency = series!.currency;
      previousClose = prevPt?.close;
      priceSource = 'eod';
      priceDate = lastPt.date;
    } else if (isDerivative(type) || type === 'other') {
      const lastTrade = [...trades].reverse().find((t) => assetKey(t.asset.symbol, t.asset.type) === key);
      price = lastTrade?.price;
      quoteCurrency = lastTrade?.currency;
      priceSource = 'trade';
      priceDate = lastTrade ? tradeDate(lastTrade) : undefined;
    }
    if (price === undefined) missingQuotes.push(p0.asset.symbol);
    const rate = price !== undefined && quoteCurrency ? fx(quoteCurrency, baseCurrency, today) : undefined;
    if (price !== undefined && rate === undefined && quoteCurrency) missingFx.add(quoteCurrency);

    const market = price !== undefined && rate !== undefined ? quantity * price * rate : undefined;
    const unrealizedBase = market !== undefined && costBasisBase !== undefined ? market - costBasisBase : undefined;
    const valueBase = future ? unrealizedBase : market;
    const dayChangeBase =
      previousClose !== undefined && price !== undefined && rate !== undefined ? quantity * (price - previousClose) * rate : undefined;
    const dayChangePct =
      q?.dayChangePercent ?? (previousClose && price !== undefined ? ((price - previousClose) / previousClose) * 100 : undefined);

    const h: Holding = {
      key,
      symbol: p0.asset.symbol,
      type,
      name: q?.name ?? names.get(key),
      exchange: q?.exchange,
      platforms: open.map((p) => p.platform),
      accounts: open.map((p) => ({ platform: p.platform, quantity: p.quantity, avgCost: p.avgCost })),
      tradeCurrency: p0.currency,
      quoteCurrency,
      quantity,
      avgCost: quantity ? costBasis / quantity : 0,
      price,
      priceSource,
      priceDate,
      previousClose,
      dayChangePct,
      dayChangeBase,
      valueBase,
      costBasisBase: future ? 0 : costBasisBase,
      unrealizedBase,
      unrealizedPct: unrealizedBase !== undefined && costBasisBase ? (unrealizedBase / Math.abs(costBasisBase)) * 100 : undefined,
      realizedBase,
      incomeBase,
      intraday: q?.intraday ?? [],
      firstTradeAt,
      mixedCurrency: list.some((p) => p.mixedCurrency),
      splits: open[0].splits,
      contract: p0.contract,
      unsettled: open.some((p) => p.unsettled) || undefined,
      oversold: list.reduce((s, p) => s + p.oversold, 0) || undefined,
      missing: price === undefined ? 'quote' : rate === undefined ? 'fx' : undefined,
    };
    (isDerivative(type) ? derivatives : holdings).push(h);
  }

  // Cash on tracked platforms, valued today.
  const cashLines: CashLine[] = cashBalances(r.flows, cash).map((b) => {
    const rate = fx(b.currency, baseCurrency, today);
    if (rate === undefined) missingFx.add(b.currency);
    return { ...b, valueBase: rate === undefined ? undefined : b.amount * rate };
  });

  // Totals. Value only counts priced rows; anything missing is listed, never silently dropped.
  const all = [...holdings, ...derivatives];
  const sum = (rows: Holding[], f: (h: Holding) => number | undefined) => rows.reduce((s, h) => s + (fin(f(h)) ?? 0), 0);
  const complete = all.every((h) => h.valueBase !== undefined && h.costBasisBase !== undefined);
  const holdingsValue = sum(all, (h) => h.valueBase);
  const cashValue = cashLines.reduce((s, c) => s + (c.valueBase ?? 0), 0);
  const priced = all.filter((h) => h.unrealizedBase !== undefined);
  const unrealized = sum(priced, (h) => h.unrealizedBase);
  const pricedCost = sum(priced.filter((h) => h.type !== 'future'), (h) => h.costBasisBase);
  const dayChange = sum(all, (h) => h.dayChangeBase);
  const prevValue = holdingsValue - dayChange;
  const incomeTotal = money.dividends + money.interest;
  const totalReturn = realized !== undefined ? unrealized + realized + incomeTotal - money.charges : undefined;
  const putIn = money.bought + Math.max(0, -money.futures);

  for (const h of holdings) h.weight = h.valueBase !== undefined && holdingsValue ? (h.valueBase / holdingsValue) * 100 : undefined;
  const byValue = (a: Holding, b: Holding) => (b.valueBase ?? -Infinity) - (a.valueBase ?? -Infinity);
  holdings.sort(byValue);
  derivatives.sort((a, b) => (a.contract?.expiry ?? '').localeCompare(b.contract?.expiry ?? '') || a.symbol.localeCompare(b.symbol));
  closed.sort((a, b) => (a.lastTradeAt < b.lastTradeAt ? 1 : -1));

  // Allocation: what you own, plus cash. F&O exposure isn't ownership, so it stays out.
  const total = sum(holdings, (h) => (h.valueBase ?? 0) > 0 ? h.valueBase : 0) + Math.max(0, cashValue);
  const byCurrency = new Map<string, number>();
  const byType = new Map<string, number>();
  const byPlatform = new Map<string, number>();
  for (const h of holdings) {
    if (!h.valueBase || h.valueBase < 0 || h.price === undefined) continue;
    add(byCurrency, h.quoteCurrency ?? h.tradeCurrency ?? baseCurrency, h.valueBase);
    add(byType, h.type, h.valueBase);
    const rate = h.valueBase / (h.quantity * h.price);
    for (const a of h.accounts) add(byPlatform, a.platform, a.quantity * h.price * rate);
  }
  for (const c of cashLines) {
    if (!c.valueBase || c.valueBase < 0) continue;
    add(byCurrency, c.currency, c.valueBase);
    add(byType, 'cash', c.valueBase);
    add(byPlatform, c.platform, c.valueBase);
  }

  // History and XIRR
  let history: HistoryPoint[] = [];
  if (input.withHistory !== false) {
    history = buildHistory({
      trades,
      prices,
      baseCurrency,
      fx,
      end: today,
      splits: input.splits,
      method,
      settlement,
      benchmark: input.benchmark,
    });
    // Today's point uses live prices when every holding is priced.
    const last = history[history.length - 1];
    if (last && complete) last.value = holdingsValue;
  }
  const flows = complete ? xirrFlows({ flows: r.flows, cash, baseCurrency, fx, currentValue: holdingsValue, asOf: today }) : undefined;
  const rate = flows ? xirr(flows) : undefined;

  // Benchmark: the same trade money in the index, valued today.
  let benchmarkValue: number | undefined;
  let benchmarkXirr: number | undefined;
  const lastPoint = history[history.length - 1];
  if (lastPoint?.benchmark !== undefined) {
    benchmarkValue = lastPoint.benchmark;
    const bf = xirrFlows({ flows: r.flows, cash: [], baseCurrency, fx, currentValue: benchmarkValue, asOf: today });
    const br = bf ? xirr(bf) : undefined;
    benchmarkXirr = br === undefined ? undefined : br * 100;
  }

  const sales = saleRows(r.realizations, input.settings.longTermMonths);
  const suggestions = missingDividends({ trades, cash, events: input.dividends, splits: input.splits, asOf: today });

  const quoteTimes = Array.from(quotes.values()).map((q) => q.timestamp);
  const pricesAsOf = quoteTimes.length ? Math.max(...quoteTimes) : undefined;
  const fxDate = input.fxRows.reduce((m, row) => (row.date > m ? row.date : m), '');
  const shown = Array.from(new Set([...all.map((h) => h.quoteCurrency), ...cashLines.map((c) => c.currency)].filter(Boolean))) as string[];

  const snapshot: PortfolioSnapshot = {
    baseCurrency,
    platforms: input.platforms,
    settings: input.settings,
    tradeCount: trades.length,
    cashCount: cash.length,
    holdings,
    derivatives,
    closed,
    cash: cashLines,
    totals: {
      value: all.length || cashLines.length ? holdingsValue + cashValue : undefined,
      holdingsValue: all.length ? holdingsValue : undefined,
      cashValue: cashLines.length ? cashValue : undefined,
      costBasis: all.every((h) => h.costBasisBase !== undefined) ? sum(holdings, (h) => h.costBasisBase) + sum(derivatives, (h) => h.costBasisBase) : undefined,
      unrealized: all.length ? unrealized : undefined,
      unrealizedPct: pricedCost ? (unrealized / Math.abs(pricedCost)) * 100 : undefined,
      realized,
      income: incomeTotal || undefined,
      charges: money.charges || undefined,
      totalReturn,
      totalReturnPct: totalReturn !== undefined && putIn ? (totalReturn / putIn) * 100 : undefined,
      dayChange: all.some((h) => h.dayChangeBase !== undefined) ? dayChange : undefined,
      dayChangePct: prevValue ? (dayChange / Math.abs(prevValue)) * 100 : undefined,
      xirr: rate === undefined ? undefined : rate * 100,
      benchmarkValue,
      benchmarkXirr,
    },
    money,
    allocation: {
      platform: slices(byPlatform, total),
      currency: slices(byCurrency, total),
      type: slices(byType, total),
    },
    history,
    pricesAsOf,
    pricesStale: pricesAsOf !== undefined && Date.now() - pricesAsOf > 4 * 86400000,
    sources: input.sources,
    fx: {
      date: fxDate || today,
      rates: shown
        .filter((c) => c !== baseCurrency)
        .map((c) => ({ currency: c, toBase: fx(c, baseCurrency, today) }))
        .filter((x): x is { currency: string; toBase: number } => x.toBase !== undefined),
    },
    missingQuotes,
    missingFx: Array.from(missingFx),
    unloggedDividends: suggestions.length,
  };
  return { snapshot, input, replay: r, sales, suggestions };
}

// ---------- Loading ----------

async function selectAll<T>(supabase: SupabaseClient, table: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order).order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function readSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('user_settings').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    baseCurrency: String(d.base_currency ?? 'USD').toUpperCase(),
    platforms: normalizePlatforms(d.platforms as string[] | null | undefined),
    settings: {
      costMethod: d.cost_method === 'average' ? 'average' : 'fifo',
      fyStartMonth: Number(d.fy_start_month ?? DEFAULT_SETTINGS.fyStartMonth) || 1,
      longTermMonths: Number(d.long_term_months ?? DEFAULT_SETTINGS.longTermMonths) || 12,
      benchmark: typeof d.benchmark === 'string' && d.benchmark ? d.benchmark : null,
    } satisfies PortfolioSettings,
  };
}

/** The signed-in user's trades and cash entries (RLS scopes every query). Cached per request. */
export const loadLedger = cache(async (supabase: SupabaseClient) => {
  const [s, tradeRows, cashRows] = await Promise.all([
    readSettings(supabase),
    selectAll<TradeRow>(supabase, 'trades', 'occurred_at'),
    selectAll<CashRow>(supabase, 'cash_entries', 'occurred_at'),
  ]);
  return { ...s, trades: tradeRows.map(toTradeLike), cash: cashRows.map(toCashLike) };
});

/**
 * Build the full portfolio for the signed-in user, optionally for one platform.
 * Never throws for market-data failures; affected holdings are listed in `missingQuotes` / `missingFx`.
 */
export const loadPortfolio = cache(
  async (supabase: SupabaseClient, platform: string | undefined, withHistory: boolean): Promise<PortfolioModel> => {
    const ledger = await loadLedger(supabase);
    const trades = platform ? ledger.trades.filter((t) => t.platform === platform) : ledger.trades;
    const cash = platform ? ledger.cash.filter((c) => c.platform === platform) : ledger.cash;
    const today = isoDate();

    // Assets and currencies involved
    const first = new Map<string, MarketAsset>();
    for (const t of trades) {
      const key = assetKey(t.asset.symbol, t.asset.type);
      if (!first.has(key)) {
        first.set(key, { key, symbol: t.asset.symbol, type: String(t.asset.type), from: tradeDate(t), contract: t.contract ?? undefined });
      }
    }
    const dates = [...trades.map((t) => t.occurredAt), ...cash.map((c) => c.occurredAt)];
    const since = dates.length ? dates.reduce((m, d) => (d < m ? d : m)).slice(0, 10) : today;
    const currencies = new Set<string>([ledger.baseCurrency]);
    trades.forEach((t) => {
      if (t.currency) currencies.add(t.currency);
      if (t.fxQuote) currencies.add(t.fxQuote.toUpperCase());
    });
    cash.forEach((c) => currencies.add(c.currency));

    // Open positions get live quotes; everything gets daily history.
    const open = replay(trades, { includeClosed: false }).positions;
    const openKeys = new Set(open.map((p) => p.assetKey));
    const assets = Array.from(first.values());

    const [market, quotes] = await Promise.all([
      loadMarket(supabase, {
        assets,
        currencies: Array.from(currencies),
        since,
        benchmark: withHistory ? ledger.settings.benchmark : null,
      }),
      fetchQuotes(
        new Map(
          assets
            .filter((a) => openKeys.has(a.key))
            .map((a) => [a.key, { id: sourceId(a.symbol, a.type) ?? '', type: a.type }] as const)
            .filter(([, v]) => v.id)
        )
      ),
    ]);

    // A quote in a currency we didn't load (rare: listing currency differs from trade currency).
    let fxRows = market.fx;
    const loaded = new Set(fxRows.map((r) => r.currency));
    const extra = Array.from(new Set(Array.from(quotes.values()).map((q) => q.currency))).filter((c) => c !== 'USD' && !loaded.has(c) && !currencies.has(c));
    if (extra.length) fxRows = [...fxRows, ...(await loadFx(supabase, extra, since))];

    const sources = new Set<string>();
    for (const [key, id] of market.sources) if (openKeys.has(key) || withHistory) sources.add(sourceName(id));

    return assemble({
      baseCurrency: ledger.baseCurrency,
      platforms: ledger.platforms,
      settings: ledger.settings,
      trades,
      cash,
      prices: market.prices,
      splits: market.splits,
      dividends: market.dividends,
      fxRows,
      benchmark: market.benchmark,
      underlyings: market.underlyings,
      quotes,
      sources: Array.from(sources),
      today,
      withHistory,
    });
  }
);

export async function getPortfolio(
  supabase: SupabaseClient,
  opts: { platform?: string; withHistory?: boolean } = {}
): Promise<PortfolioSnapshot> {
  return (await loadPortfolio(supabase, opts.platform, opts.withHistory !== false)).snapshot;
}

export type ChartPoint = { d: string; v: number; i: number; b?: number };

/**
 * Shrink daily history for the client: every day for the last ~13 months, one point a week before that.
 * The last point is always kept.
 */
export function chartPoints(history: HistoryPoint[]): ChartPoint[] {
  if (!history.length) return [];
  const last = history[history.length - 1].date;
  const cutoff = new Date(Date.parse(`${last}T00:00:00Z`) - 400 * 86400000).toISOString().slice(0, 10);
  const r = (v: number) => Math.round(v * 100) / 100;
  return history
    .filter((p, i) => p.date >= cutoff || i % 7 === 0 || i === history.length - 1)
    .map((p) => ({ d: p.date, v: r(p.value), i: r(p.invested), ...(p.benchmark !== undefined ? { b: r(p.benchmark) } : {}) }));
}

/** Signed cash amount for display: deposits +, withdrawals −. */
export function signedCash(c: Pick<CashEntryLike, 'kind' | 'amount'>) {
  return cashSign(c.kind) * c.amount;
}
