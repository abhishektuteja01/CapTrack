// src/lib/portfolio.ts
// Assembles everything the dashboard shows: holdings, totals, allocation and history,
// all in the user's base currency. Server only.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assetKey,
  derivePositions,
  type FxLookup,
  type Position,
  type TradeLike,
} from '@/lib/domain/portfolio/positions';
import { buildHistory, portfolioCashFlows, type HistoryPoint } from '@/lib/domain/portfolio/history';
import { xirr } from '@/lib/domain/portfolio/xirr';
import type { Split } from '@/lib/domain/portfolio/splits';
import { makeFxLookup } from '@/lib/domain/fx/rates';
import { fetchYahooPrices, toYahooSymbol, type YahooQuote } from '@/lib/services/prices/yahoo';
import { isoDate, loadPriceHistory, loadUsdRates } from '@/lib/services/market/store';
import { normalizePlatforms } from '@/lib/settings';

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
  fx_rate?: number | string | null;
  fx_quote?: string | null;
};

export function toTradeLike(t: TradeRow): TradeLike & { platform: string } {
  return {
    id: t.id,
    occurredAt: t.occurred_at,
    asset: { symbol: t.asset_symbol, type: t.asset_type },
    side: t.side,
    quantity: Number(t.quantity),
    price: Number(t.price),
    fees: Number(t.fees ?? 0),
    currency: (t.currency ?? '').toUpperCase() || undefined,
    fxRate: t.fx_rate == null ? null : Number(t.fx_rate),
    fxQuote: t.fx_quote ?? null,
    platform: t.platform?.trim() || 'Manual',
  };
}

export type Holding = {
  key: string;
  symbol: string;
  type: string;
  name?: string;
  exchange?: string;
  platforms: string[];
  /** Currency the trades were entered in. */
  tradeCurrency?: string;
  /** Currency the live price is quoted in (major unit). */
  quoteCurrency?: string;
  quantity: number;
  avgCost: number; // trade currency
  price?: number; // quote currency
  previousClose?: number;
  dayChangePct?: number;
  dayChangeBase?: number;
  valueBase?: number;
  costBasisBase?: number;
  unrealizedBase?: number;
  unrealizedPct?: number;
  realizedBase?: number;
  weight?: number; // % of total value
  intraday: number[];
  firstTradeAt: string;
  mixedCurrency: boolean;
  /** Splits applied to this holding. */
  splits: Split[];
  missing?: 'quote' | 'fx';
};

export type ClosedHolding = {
  key: string;
  symbol: string;
  type: string;
  tradeCurrency?: string;
  realized: number;
  realizedBase?: number;
  lastTradeAt: string;
};

export type Slice = { key: string; value: number; weight: number };

export type PortfolioSnapshot = {
  baseCurrency: string;
  platforms: string[];
  tradeCount: number;
  holdings: Holding[];
  closed: ClosedHolding[];
  totals: {
    value?: number;
    costBasis?: number;
    unrealized?: number;
    unrealizedPct?: number;
    realized?: number;
    dayChange?: number;
    dayChangePct?: number;
    xirr?: number; // percent
  };
  allocation: { platform: Slice[]; currency: Slice[]; type: Slice[] };
  history: HistoryPoint[];
  /** Latest quote time (ms) across holdings. */
  pricesAsOf?: number;
  /** True when the latest quote is more than 4 days old. */
  pricesStale: boolean;
  /** FX date used for today's conversion, and 1 unit → base for each currency shown. */
  fx: { date: string; rates: { currency: string; toBase: number }[] };
  missingQuotes: string[];
  missingFx: string[];
};

function slices(map: Map<string, number>, total: number): Slice[] {
  return Array.from(map, ([key, value]) => ({ key, value, weight: total ? (value / total) * 100 : 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

function add(map: Map<string, number>, key: string, v: number) {
  map.set(key, (map.get(key) ?? 0) + v);
}

async function loadTrades(supabase: SupabaseClient): Promise<TradeRow[]> {
  const out: TradeRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('occurred_at')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as TradeRow[]));
    if (!data || data.length < 1000) return out;
  }
}

/**
 * Build the full portfolio snapshot for the signed-in user (RLS scopes every query).
 * Never throws for market-data failures; affected holdings are listed in `missingQuotes` / `missingFx`.
 */
export async function getPortfolio(
  supabase: SupabaseClient,
  opts: { platform?: string; withHistory?: boolean } = {}
): Promise<PortfolioSnapshot> {
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('base_currency, platforms')
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message);

  const baseCurrency = String(settings?.base_currency ?? 'USD').toUpperCase();
  const platforms = normalizePlatforms(settings?.platforms as string[] | null | undefined);

  const all = (await loadTrades(supabase)).map(toTradeLike);
  const trades = opts.platform ? all.filter((t) => t.platform === opts.platform) : all;
  const today = isoDate();

  const empty: PortfolioSnapshot = {
    baseCurrency,
    platforms,
    tradeCount: trades.length,
    holdings: [],
    closed: [],
    totals: {},
    allocation: { platform: [], currency: [], type: [] },
    history: [],
    fx: { date: today, rates: [] },
    pricesStale: false,
    missingQuotes: [],
    missingFx: [],
  };
  if (!trades.length) return empty;

  // 1. Live quotes for open positions, and daily history + splits for every asset ever traded
  const nativePositions = derivePositions(trades, { includeClosed: true });
  const open = nativePositions.filter((p) => !p.closed);
  const firstByKey = new Map<string, TradeLike>();
  trades.forEach((t) => {
    const k = assetKey(t.asset.symbol, t.asset.type);
    if (!firstByKey.has(k)) firstByKey.set(k, t);
  });
  const [quotes, priceHistory] = await Promise.all([
    fetchYahooPrices(open.map((p) => ({ symbol: p.asset.symbol, assetType: String(p.asset.type) }))).catch(
      (e): YahooQuote[] => {
        console.error('[portfolio] quotes failed', e instanceof Error ? e.message : e);
        return [];
      }
    ),
    loadPriceHistory(
      supabase,
      Array.from(firstByKey, ([key, t]) => ({
        key,
        symbol: t.asset.symbol,
        type: String(t.asset.type),
        from: t.occurredAt.slice(0, 10),
      }))
    ),
  ]);
  const { splits } = priceHistory;
  const quoteBySymbol = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]));
  const quoteFor = (p: Pick<Position, 'asset'>) =>
    quoteBySymbol.get(toYahooSymbol(p.asset.symbol, String(p.asset.type)).toUpperCase());

  // 2. FX for every currency involved, from the first trade to today
  const firstDate = trades.reduce((m, t) => (t.occurredAt < m ? t.occurredAt : m), trades[0].occurredAt).slice(0, 10);
  const currencies = new Set<string>([baseCurrency]);
  trades.forEach((t) => t.currency && currencies.add(t.currency));
  quotes.forEach((q) => currencies.add(q.currency));
  const { rows } = await loadUsdRates(supabase, Array.from(currencies), firstDate);
  const fx: FxLookup = makeFxLookup(rows);

  // 3. Positions with base-currency cost and realized P&L
  const positions = derivePositions(trades, { baseCurrency, fx, includeClosed: true, splits });
  const platformsByKey = new Map<string, Set<string>>();
  trades.forEach((t) => {
    const k = assetKey(t.asset.symbol, t.asset.type);
    const s = platformsByKey.get(k) ?? new Set<string>();
    s.add(t.platform);
    platformsByKey.set(k, s);
  });

  const missingQuotes: string[] = [];
  const missingFx = new Set<string>();
  const holdings: Holding[] = [];
  const closed: ClosedHolding[] = [];
  let realized: number | undefined = 0;

  for (const p of positions) {
    const key = assetKey(p.asset.symbol, p.asset.type);
    if (p.realizedBase === undefined) {
      realized = undefined;
      if (p.currency) missingFx.add(p.currency);
    } else if (realized !== undefined) {
      realized += p.realizedBase;
    }

    if (p.closed) {
      closed.push({
        key,
        symbol: p.asset.symbol,
        type: String(p.asset.type),
        tradeCurrency: p.currency,
        realized: p.realized,
        realizedBase: p.realizedBase,
        lastTradeAt: p.lastTradeAt,
      });
      continue;
    }

    const q = quoteFor(p);
    const rate = q ? fx(q.currency, baseCurrency, today) : undefined;
    if (!q) missingQuotes.push(p.asset.symbol);
    else if (rate === undefined) missingFx.add(q.currency);

    const valueBase = q && rate !== undefined ? p.quantity * q.price * rate : undefined;
    const dayChangeBase =
      q?.previousClose !== undefined && rate !== undefined
        ? p.quantity * (q.price - q.previousClose) * rate
        : undefined;
    const dayChangePct =
      q?.dayChangePercent ??
      (q?.previousClose ? ((q.price - q.previousClose) / q.previousClose) * 100 : undefined);
    const unrealizedBase =
      valueBase !== undefined && p.costBasisBase !== undefined ? valueBase - p.costBasisBase : undefined;

    holdings.push({
      key,
      symbol: p.asset.symbol,
      type: String(p.asset.type),
      name: q?.name,
      exchange: q?.exchange,
      platforms: Array.from(platformsByKey.get(key) ?? []),
      tradeCurrency: p.currency,
      quoteCurrency: q?.currency,
      quantity: p.quantity,
      avgCost: p.avgCost,
      price: q?.price,
      previousClose: q?.previousClose,
      dayChangePct,
      dayChangeBase,
      valueBase,
      costBasisBase: p.costBasisBase,
      unrealizedBase,
      unrealizedPct:
        unrealizedBase !== undefined && p.costBasisBase ? (unrealizedBase / p.costBasisBase) * 100 : undefined,
      realizedBase: p.realizedBase,
      intraday: q?.intraday ?? [],
      firstTradeAt: p.firstTradeAt,
      mixedCurrency: p.mixedCurrency,
      splits: p.splits,
      missing: !q ? 'quote' : rate === undefined ? 'fx' : undefined,
    });
  }

  // 4. Totals. Value only counts priced holdings; anything missing is listed, never silently dropped.
  const complete = holdings.every((h) => h.valueBase !== undefined && h.costBasisBase !== undefined);
  const sum = (f: (h: Holding) => number | undefined) =>
    holdings.reduce((s, h) => s + (f(h) ?? 0), 0);
  const value = sum((h) => h.valueBase);
  const costBasis = sum((h) => h.costBasisBase);
  const pricedCost = sum((h) => (h.valueBase !== undefined ? h.costBasisBase : 0));
  const unrealized = value - pricedCost;
  const dayChange = sum((h) => h.dayChangeBase);
  const prevValue = value - dayChange;

  holdings.forEach((h) => {
    h.weight = h.valueBase !== undefined && value ? (h.valueBase / value) * 100 : undefined;
  });
  holdings.sort((a, b) => (b.valueBase ?? -1) - (a.valueBase ?? -1));
  closed.sort((a, b) => (a.lastTradeAt < b.lastTradeAt ? 1 : -1));

  // 5. Allocation
  const byCurrency = new Map<string, number>();
  const byType = new Map<string, number>();
  for (const h of holdings) {
    if (h.valueBase === undefined) continue;
    add(byCurrency, h.quoteCurrency ?? h.tradeCurrency ?? baseCurrency, h.valueBase);
    add(byType, h.type, h.valueBase);
  }
  const byPlatform = new Map<string, number>();
  const tradesByPlatform = new Map<string, TradeLike[]>();
  trades.forEach((t) => {
    const list = tradesByPlatform.get(t.platform) ?? [];
    list.push(t);
    tradesByPlatform.set(t.platform, list);
  });
  for (const [platform, list] of tradesByPlatform) {
    for (const p of derivePositions(list, { splits })) {
      const q = quoteFor(p);
      const rate = q ? fx(q.currency, baseCurrency, today) : undefined;
      if (q && rate !== undefined) add(byPlatform, platform, p.quantity * q.price * rate);
    }
  }

  // 6. History and XIRR
  let history: HistoryPoint[] = [];
  if (opts.withHistory !== false) {
    history = buildHistory({ trades, prices: priceHistory.prices, baseCurrency, fx, end: today, splits });
    // Today's point uses live prices when every holding is priced.
    const last = history[history.length - 1];
    if (last && complete) last.value = value;
  }

  const flows = complete
    ? portfolioCashFlows({ trades, baseCurrency, fx, currentValue: value, asOf: today })
    : undefined;
  const rate = flows ? xirr(flows) : undefined;

  const pricesAsOf = quotes.length ? Math.max(...quotes.map((q) => q.timestamp)) : undefined;
  const fxDate = rows.reduce((m, r) => (r.date > m ? r.date : m), '');
  const shownCurrencies = Array.from(new Set(holdings.map((h) => h.quoteCurrency).filter(Boolean))) as string[];

  return {
    baseCurrency,
    platforms,
    tradeCount: trades.length,
    holdings,
    closed,
    totals: {
      value: holdings.length ? value : undefined,
      costBasis: holdings.every((h) => h.costBasisBase !== undefined) ? costBasis : undefined,
      unrealized: holdings.length ? unrealized : undefined,
      unrealizedPct: pricedCost ? (unrealized / pricedCost) * 100 : undefined,
      realized,
      dayChange: holdings.some((h) => h.dayChangeBase !== undefined) ? dayChange : undefined,
      dayChangePct: prevValue ? (dayChange / prevValue) * 100 : undefined,
      xirr: rate === undefined ? undefined : rate * 100,
    },
    allocation: {
      platform: slices(byPlatform, value),
      currency: slices(byCurrency, value),
      type: slices(byType, value),
    },
    history,
    pricesAsOf,
    pricesStale: pricesAsOf !== undefined && Date.now() - pricesAsOf > 4 * 86400000,
    fx: {
      date: fxDate || today,
      rates: shownCurrencies
        .filter((c) => c !== baseCurrency)
        .map((c) => ({ currency: c, toBase: fx(c, baseCurrency, today) }))
        .filter((r): r is { currency: string; toBase: number } => r.toBase !== undefined),
    },
    missingQuotes,
    missingFx: Array.from(missingFx),
  };
}

export type ChartPoint = { d: string; v: number; c: number };

/**
 * Shrink daily history for the client: every day for the last ~13 months, one point a week before that.
 * The last point is always kept.
 */
export function chartPoints(history: HistoryPoint[]): ChartPoint[] {
  if (!history.length) return [];
  const last = history[history.length - 1].date;
  const cutoff = new Date(Date.parse(`${last}T00:00:00Z`) - 400 * 86400000).toISOString().slice(0, 10);
  return history
    .filter((p, i) => p.date >= cutoff || i % 7 === 0 || i === history.length - 1)
    .map((p) => ({ d: p.date, v: Math.round(p.value * 100) / 100, c: Math.round(p.costBasis * 100) / 100 }));
}
