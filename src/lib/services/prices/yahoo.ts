// src/lib/services/prices/yahoo.ts
// Yahoo Finance price service (stocks + crypto via *-USD symbols)
// No API keys required. Uses the public chart endpoint, which is unofficial:
// every caller must handle failures.

import { normalizeCurrency } from '@/lib/domain/fx/rates';
import type { PricePoint } from '@/lib/domain/portfolio/history';
import type { Split } from '@/lib/domain/portfolio/splits';

export type YahooQuote = {
  symbol: string;
  /** Best-effort display name from Yahoo chart meta (shortName/longName). */
  name?: string;
  /** Latest price in major units of `currency` (pence are converted to pounds). */
  price: number;
  /** ISO 4217, major unit. */
  currency: string;
  /** Previous close (best effort), same units as `price`. */
  previousClose?: number;
  /** Regular market change percent (best effort) as a percent value, e.g. 1.23 means +1.23%. */
  dayChangePercent?: number;
  timestamp: number; // unix ms
  exchange?: string;
  /** Today's intraday closes (1-minute), same units as `price`. */
  intraday: number[];
};

export class YahooPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YahooPriceError';
  }
}

/**
 * Map internal asset symbols to Yahoo Finance symbols.
 * - Stocks/ETFs: AAPL -> AAPL
 * - Crypto: BTC -> BTC-USD
 */
export function toYahooSymbol(symbol: string, assetType?: string) {
  if (!symbol) return symbol;
  const s = symbol.toUpperCase().trim();

  if (assetType === 'crypto') {
    // If already a Yahoo crypto pair like ETH-USD, keep it as-is.
    if (s.includes('-')) return s;
    return `${s}-USD`;
  }

  return s;
}

type YahooChartMeta = {
  currency?: string;
  shortName?: string;
  longName?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  gmtoffset?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
};

type YahooChartResult = {
  meta?: YahooChartMeta;
  events?: {
    splits?: Record<string, { date: number; numerator: number; denominator: number }>;
    dividends?: Record<string, { date: number; amount: number }>;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
};

/** Fetch and parse one chart result. Throws YahooPriceError on any failure. */
async function fetchChart(
  yahooSymbol: string,
  query: string,
  revalidate: number
): Promise<YahooChartResult> {
  const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?${query}`;
  const get = (host: string) =>
    fetch(`https://${host}.finance.yahoo.com${path}`, {
      headers: {
        'User-Agent': 'CapTrack/1.0',
        Accept: 'application/json,text/plain,*/*',
      },
      next: { revalidate },
    });

  // Yahoo rate-limits by host; the second host often still answers.
  let res = await get('query1');
  if (res.status === 429 || res.status >= 500) res = await get('query2');

  const raw = await res.text();

  if (!res.ok) {
    console.error('[yahoo] request failed', {
      symbol: yahooSymbol,
      status: res.status,
      statusText: res.statusText,
    });
    if (process.env.NODE_ENV !== 'production') {
      console.error('[yahoo] body snippet:', raw.slice(0, 300));
    }
    throw new YahooPriceError(`Yahoo request failed for ${yahooSymbol}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error('[yahoo] JSON parse failed for', yahooSymbol);
    throw new YahooPriceError(`Yahoo JSON parse failed for ${yahooSymbol}`);
  }

  const result =
    typeof json === 'object' && json !== null
      ? (json as { chart?: { result?: unknown[] } })?.chart?.result?.[0]
      : undefined;

  if (!result || typeof result !== 'object') {
    console.error('[yahoo] no chart result for', yahooSymbol);
    throw new YahooPriceError(`No chart result for ${yahooSymbol}`);
  }

  return result as YahooChartResult;
}

/**
 * Fetch the latest price for a single symbol from Yahoo Finance.
 * Uses the public chart endpoint with 1d/1m resolution.
 */
export async function fetchYahooPrice(
  symbol: string,
  assetType?: string
): Promise<YahooQuote> {
  const yahooSymbol = toYahooSymbol(symbol, assetType);

  // FX symbols (e.g., USDINR=X) can intermittently return empty 1m data.
  // Use a slightly wider range + daily interval for robustness.
  const range = assetType === 'fx' ? '5d' : '1d';
  const interval = assetType === 'fx' ? '1d' : '1m';
  const result = await fetchChart(yahooSymbol, `range=${range}&interval=${interval}`, 60);

  const meta = result.meta;
  const { currency, factor } = normalizeCurrency(meta?.currency ?? 'USD');
  const previousClose =
    meta?.previousClose ?? meta?.regularMarketPreviousClose ?? meta?.chartPreviousClose;

  const timestamps: number[] = result.timestamp ?? [];
  const closes: Array<number | null> = result.indicators?.quote?.[0]?.close ?? [];

  // Take the latest non-null close
  let idx = closes.length - 1;
  while (idx >= 0 && closes[idx] == null) idx--;

  if (!timestamps.length || idx < 0) {
    throw new YahooPriceError(`No price data for ${yahooSymbol}`);
  }

  return {
    symbol: yahooSymbol,
    name: meta?.shortName ?? meta?.longName,
    price: (closes[idx] as number) * factor,
    currency,
    previousClose: typeof previousClose === 'number' ? previousClose * factor : undefined,
    dayChangePercent:
      typeof meta?.regularMarketChangePercent === 'number'
        ? meta.regularMarketChangePercent
        : undefined,
    timestamp: timestamps[idx] * 1000,
    exchange: meta?.fullExchangeName ?? meta?.exchangeName,
    intraday: thin(closes.filter((c): c is number => c != null).map((c) => c * factor), 80),
  };
}

/** Keep about `n` evenly spaced points (always the last one): a sparkline doesn't need 390. */
function thin(values: number[], n: number) {
  if (values.length <= n) return values;
  const step = values.length / n;
  const out: number[] = [];
  for (let i = 0; i < n - 1; i++) out.push(values[Math.floor(i * step)]);
  out.push(values[values.length - 1]);
  return out;
}

/**
 * Fetch prices for multiple assets in parallel.
 * Fails soft: returns only successful quotes.
 */
export async function fetchYahooPrices(
  assets: { symbol: string; assetType?: string }[]
): Promise<YahooQuote[]> {
  const results = await Promise.allSettled(
    assets.map((a) => fetchYahooPrice(a.symbol, a.assetType))
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const a = assets[i];
      console.error('[yahoo] quote failed', {
        symbol: toYahooSymbol(a.symbol, a.assetType),
        assetType: a.assetType,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });

  return results
    .filter((r): r is PromiseFulfilledResult<YahooQuote> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Daily closes from `from` (YYYY-MM-DD) to today, in major units, plus reported splits.
 * Dates are the exchange's local trading day. Closes are as Yahoo returns them (usually split-adjusted).
 */
export async function fetchDailyHistory(
  symbol: string,
  assetType: string | undefined,
  from: string
): Promise<{ symbol: string; currency: string; points: PricePoint[]; splits: Split[]; dividends: PricePoint[] }> {
  const yahooSymbol = toYahooSymbol(symbol, assetType);
  const period1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const result = await fetchChart(
    yahooSymbol,
    `period1=${period1}&period2=${period2}&interval=1d&events=div%2Csplit`,
    3600
  );

  const { currency, factor } = normalizeCurrency(result.meta?.currency ?? 'USD');
  const offset = result.meta?.gmtoffset ?? 0;
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  const byDate = new Map<string, number>();
  timestamps.forEach((ts, i) => {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) return;
    const date = new Date((ts + offset) * 1000).toISOString().slice(0, 10);
    byDate.set(date, c * factor); // a later row for the same day wins
  });

  const splits: Split[] = Object.values(result.events?.splits ?? {})
    .filter((e) => e.numerator > 0 && e.denominator > 0)
    .map((e) => ({
      date: new Date((e.date + offset) * 1000).toISOString().slice(0, 10),
      ratio: e.numerator / e.denominator,
      source: 'yahoo' as const,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Per-share amounts, same units as the closes. The date is the ex-dividend day.
  const dividends: PricePoint[] = Object.values(result.events?.dividends ?? {})
    .filter((e) => e.amount > 0)
    .map((e) => ({ date: new Date((e.date + offset) * 1000).toISOString().slice(0, 10), close: e.amount * factor }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    symbol: yahooSymbol,
    currency,
    splits,
    dividends,
    points: Array.from(byDate, ([date, close]) => ({ date, close })).sort((a, b) =>
      a.date < b.date ? -1 : 1
    ),
  };
}

/**
 * USD per 1 unit of `currency`, latest, from Yahoo (`XXXUSD=X`, falling back to `USDXXX=X` inverted).
 * Used when the ECB feed doesn't cover a currency.
 */
export async function fetchYahooUsdRate(currency: string): Promise<number | undefined> {
  const ccy = currency.toUpperCase();
  if (ccy === 'USD') return 1;
  const [direct] = await fetchYahooPrices([{ symbol: `${ccy}USD=X`, assetType: 'fx' }]);
  if (direct?.price > 0) return direct.price;
  const [reverse] = await fetchYahooPrices([{ symbol: `USD${ccy}=X`, assetType: 'fx' }]);
  if (reverse?.price > 0) return 1 / reverse.price;
  return undefined;
}

/** Daily USD-per-unit history for `currency` from Yahoo, for currencies the ECB doesn't publish. */
export async function fetchYahooUsdRateHistory(
  currency: string,
  from: string
): Promise<PricePoint[]> {
  const h = await fetchDailyHistory(`${currency.toUpperCase()}USD=X`, 'fx', from);
  return h.points;
}
