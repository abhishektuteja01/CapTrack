// src/lib/services/prices/yahoo.ts
// Yahoo Finance price service (stocks + crypto via *-USD symbols)
// No API keys required. Uses public chart endpoint.

export type YahooQuote = {
  symbol: string;
  /** Best-effort display name from Yahoo chart meta (shortName/longName). */
  name?: string;
  price: number;
  currency: string;
  /** Previous close (best effort) from Yahoo chart meta. */
  previousClose?: number;
  /** Regular market change percent (best effort) as a percent value, e.g. 1.23 means +1.23%. */
  dayChangePercent?: number;
  timestamp: number; // unix ms
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
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
};

type YahooChartResult = {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
};

function isYahooChartResult(value: unknown): value is YahooChartResult {
  return typeof value === 'object' && value !== null;
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
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'CapTrack/1.0',
      Accept: 'application/json,text/plain,*/*',
    },
    next: { revalidate: 60 },
  });

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
    if (process.env.NODE_ENV !== 'production') {
      console.error('[yahoo] body snippet:', raw.slice(0, 300));
    }
    throw new YahooPriceError(`Yahoo JSON parse failed for ${yahooSymbol}`);
  }

  const resultUnknown =
    typeof json === 'object' && json !== null
      ? (json as { chart?: { result?: unknown[] } })?.chart?.result?.[0]
      : undefined;

  const result: YahooChartResult | undefined = isYahooChartResult(resultUnknown)
    ? (resultUnknown as YahooChartResult)
    : undefined;

  if (!result) {
    console.error('[yahoo] no chart result for', yahooSymbol);
    if (process.env.NODE_ENV !== 'production') {
      const chart =
        typeof json === 'object' && json !== null
          ? (json as { chart?: unknown })?.chart
          : undefined;
      console.error('[yahoo] chart payload:', chart);
    }
    throw new YahooPriceError(`No chart result for ${yahooSymbol}`);
  }

  const meta = result.meta;
  const previousClose =
    meta?.previousClose ?? meta?.regularMarketPreviousClose ?? meta?.chartPreviousClose;

  const dayChangePercent = meta?.regularMarketChangePercent;

  const timestamps: number[] = result.timestamp ?? [];
  const prices: Array<number | null> = result.indicators?.quote?.[0]?.close ?? [];

  if (!timestamps.length || !prices.length) {
    console.error('[yahoo] no price data for', yahooSymbol);
    if (process.env.NODE_ENV !== 'production') {
      const chartObj =
        typeof json === 'object' && json !== null
          ? (json as { chart?: { error?: unknown; result?: unknown[] } }).chart
          : undefined;

      console.error('[yahoo] details:', {
        chartError: chartObj?.error,
        hasResult: Boolean(chartObj?.result?.length),
        meta: result.meta,
        range,
        interval,
      });
    }
    throw new YahooPriceError(`No price data for ${yahooSymbol}`);
  }

  // Take the latest non-null close
  let idx = prices.length - 1;
  while (idx >= 0 && prices[idx] == null) idx--;

  if (idx < 0) {
    throw new YahooPriceError(`All prices null for ${yahooSymbol}`);
  }

  return {
    symbol: yahooSymbol,
    name: meta?.shortName ?? meta?.longName,
    price: (() => {
      const p = prices[idx];
      if (p == null) throw new YahooPriceError(`All prices null for ${yahooSymbol}`);
      return p;
    })(),
    currency: meta?.currency ?? 'USD',
    previousClose: typeof previousClose === 'number' ? previousClose : undefined,
    dayChangePercent: typeof dayChangePercent === 'number' ? dayChangePercent : undefined,
    timestamp: timestamps[idx] * 1000,
  };
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

// --- FX caching (v1) ---
// Best-effort in-memory cache. On serverless (Vercel), this persists only during warm sessions.
let usdInrCache: { rate: number; fetchedAt: number } | null = null;
const USD_INR_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get USD→INR FX rate (Yahoo symbol: USDINR=X) with a 1-hour TTL cache.
 * Returns undefined if the rate cannot be fetched.
 */
export async function getUsdInrRateCached(): Promise<number | undefined> {
  const now = Date.now();
  if (usdInrCache && now - usdInrCache.fetchedAt < USD_INR_TTL_MS) {
    return usdInrCache.rate;
  }

  // Prefer direct USD → INR
  const direct = await fetchYahooPrices([{ symbol: 'USDINR=X', assetType: 'fx' }]);
  const directRate = direct?.[0]?.price;

  if (typeof directRate === 'number' && directRate > 0) {
    usdInrCache = { rate: directRate, fetchedAt: now };
    return directRate;
  }

  // Fallback: INR → USD and invert
  const reverse = await fetchYahooPrices([{ symbol: 'INRUSD=X', assetType: 'fx' }]);
  const reverseRate = reverse?.[0]?.price;

  if (typeof reverseRate === 'number' && reverseRate > 0) {
    const inverted = 1 / reverseRate;
    usdInrCache = { rate: inverted, fetchedAt: now };
    return inverted;
  }

  console.error('[fx] USD/INR unavailable from Yahoo');
  return undefined;
}