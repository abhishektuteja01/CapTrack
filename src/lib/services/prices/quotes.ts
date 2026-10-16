// src/lib/services/prices/quotes.ts
// Latest prices for open holdings from whichever source covers them. Fails soft per asset.

import { fetchYahooPrices, type YahooQuote } from './yahoo';
import { fetchMfLatest } from './mfapi';

export type Quote = Omit<YahooQuote, 'symbol'> & { source: 'yahoo' | 'amfi' };

/** `ids` maps asset key → source id (see `sourceId`). NSE contracts have no live quote and are skipped. */
export async function fetchQuotes(ids: Map<string, { id: string; type: string }>): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  const yahoo = Array.from(ids).filter(([, v]) => !v.id.includes(':'));
  const mf = Array.from(ids).filter(([, v]) => v.id.startsWith('MF:'));

  const [yq, mq] = await Promise.all([
    fetchYahooPrices(yahoo.map(([, v]) => ({ symbol: v.id, assetType: v.type }))).catch((e): YahooQuote[] => {
      console.error('[quotes] yahoo failed', e instanceof Error ? e.message : e);
      return [];
    }),
    Promise.allSettled(mf.map(([, v]) => fetchMfLatest(v.id.slice(3)))),
  ]);

  const bySymbol = new Map(yq.map((q) => [q.symbol.toUpperCase(), q]));
  for (const [key, v] of yahoo) {
    const q = bySymbol.get(v.id.toUpperCase());
    if (q) out.set(key, { ...q, source: 'yahoo' });
  }
  mf.forEach(([key], i) => {
    const r = mq[i];
    if (r.status !== 'fulfilled') return;
    const { nav, previous, date, name } = r.value;
    out.set(key, {
      name,
      price: nav,
      currency: 'INR',
      previousClose: previous,
      dayChangePercent: previous ? ((nav - previous) / previous) * 100 : undefined,
      timestamp: Date.parse(`${date}T15:30:00Z`),
      intraday: [],
      source: 'amfi',
    });
  });
  return out;
}
