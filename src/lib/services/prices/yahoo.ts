// src/lib/services/prices/yahoo.ts
// Yahoo Finance price service (stocks + crypto via *-USD symbols)
// No API keys required. Uses public chart endpoint.

export type YahooQuote = {
  symbol: string;
  /** Best-effort display name from Yahoo chart meta (shortName/longName). */
  name?: string;
  price: number;
  currency: string;
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
  const s = symbol.toUpperCase().trim();

  if (assetType === 'crypto') {
    return `${s}-USD`;
  }

  return s;
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

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=1d&interval=1m`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'CapTrack/1.0',
      Accept: 'application/json',
    },
    // allow Next.js to cache briefly (safe for portfolio usage)
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new YahooPriceError(`Yahoo request failed for ${yahooSymbol}`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];

  if (!result) {
    throw new YahooPriceError(`No chart result for ${yahooSymbol}`);
  }

  const meta = result.meta;
  const timestamps: number[] = result.timestamp ?? [];
  const prices: number[] = result.indicators?.quote?.[0]?.close ?? [];

  if (!timestamps.length || !prices.length) {
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
    price: prices[idx],
    currency: meta.currency ?? 'USD',
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

  return results
    .filter((r): r is PromiseFulfilledResult<YahooQuote> => r.status === 'fulfilled')
    .map((r) => r.value);
}