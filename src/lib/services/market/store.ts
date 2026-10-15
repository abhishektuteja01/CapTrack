// src/lib/services/market/store.ts
// Shared market data cache in Supabase: daily FX (fx_rates) and daily closes (price_history).
// Reads use the caller's client (RLS: any signed-in user can read).
// Missing data is fetched from the source and written back with the service-role client when configured.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UsdRateRow } from '@/lib/domain/fx/rates';
import type { PriceSeries } from '@/lib/domain/portfolio/history';
import { supabaseService } from '@/lib/supabase/service';
import { fetchFrankfurterRange, frankfurterCurrencies } from '@/lib/services/fx/frankfurter';
import { fetchDailyHistory, fetchYahooUsdRateHistory, toYahooSymbol } from '@/lib/services/prices/yahoo';

const PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDate(d: Date | number = Date.now()) {
  return new Date(d).toISOString().slice(0, 10);
}

function addDays(date: string, n: number) {
  return isoDate(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS);
}

/** Select every row of a filtered query, 1000 at a time (PostgREST caps each response). */
async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Data is stale when the newest stored day is more than a day behind `today` (ECB skips weekends; the fetch is cached). */
function isStale(latest: string | undefined, today: string) {
  return !latest || latest < addDays(today, -1);
}

async function writeBack(table: 'fx_rates' | 'price_history', rows: Record<string, unknown>[]) {
  const svc = supabaseService();
  if (!svc || !rows.length) return;
  for (let i = 0; i < rows.length; i += PAGE) {
    const { error } = await svc.from(table).upsert(rows.slice(i, i + PAGE));
    if (error) {
      console.error(`[market] ${table} write failed`, error.message);
      return;
    }
  }
}

/** FX source for a fetch: ECB via Frankfurter where published, Yahoo otherwise. */
async function fetchUsdRates(currencies: string[], from: string, to: string): Promise<UsdRateRow[]> {
  const ecb = await frankfurterCurrencies();
  const viaEcb = currencies.filter((c) => ecb.has(c));
  const viaYahoo = currencies.filter((c) => !ecb.has(c) && c !== 'USD');

  const rows: UsdRateRow[] = [];
  if (viaEcb.length) {
    try {
      rows.push(...(await fetchFrankfurterRange(viaEcb, from, to)));
    } catch (e) {
      console.error('[fx] frankfurter failed, using yahoo', e instanceof Error ? e.message : e);
      viaYahoo.push(...viaEcb.filter((c) => c !== 'USD'));
    }
  }
  const yahoo = await Promise.allSettled(
    viaYahoo.map(async (c) =>
      (await fetchYahooUsdRateHistory(c, from)).map((p) => ({ date: p.date, currency: c, usdPerUnit: p.close }))
    )
  );
  yahoo.forEach((r, i) => {
    if (r.status === 'fulfilled') rows.push(...r.value);
    else console.error('[fx] yahoo history failed for', viaYahoo[i]);
  });
  return rows.filter((r) => r.date >= from && r.date <= to);
}

/**
 * USD-per-unit rows covering `from`..today for each currency.
 * Reads the table, fills gaps from the source, writes them back.
 */
export async function loadUsdRates(
  supabase: SupabaseClient,
  currencies: string[],
  from: string
): Promise<{ rows: UsdRateRow[]; source: 'stored' | 'fetched' | 'mixed' }> {
  const ccys = Array.from(new Set(currencies.map((c) => c.toUpperCase()))).filter((c) => c !== 'USD');
  if (!ccys.length) return { rows: [], source: 'stored' };
  const today = isoDate();
  // a little earlier than `from` so the first day has a carried-forward rate
  const start = addDays(from, -7);

  let stored: UsdRateRow[] = [];
  try {
    stored = (
      await selectAll<{ date: string; currency: string; usd_per_unit: number }>((a, b) =>
        supabase
          .from('fx_rates')
          .select('date, currency, usd_per_unit')
          .in('currency', ccys)
          .gte('date', start)
          .order('date')
          .range(a, b)
      )
    ).map((r) => ({ date: r.date, currency: r.currency, usdPerUnit: Number(r.usd_per_unit) }));
  } catch (e) {
    console.error('[fx] read failed', e instanceof Error ? e.message : e);
  }

  const span = new Map<string, { first: string; last: string }>();
  for (const r of stored) {
    const s = span.get(r.currency);
    if (!s) span.set(r.currency, { first: r.date, last: r.date });
    else s.last = r.date;
  }

  // Group missing work by date range so each range is one request.
  const jobs = new Map<string, { from: string; to: string; ccys: string[] }>();
  const addJob = (f: string, t: string, c: string) => {
    if (f > t) return;
    const k = `${f}..${t}`;
    const j = jobs.get(k) ?? { from: f, to: t, ccys: [] };
    j.ccys.push(c);
    jobs.set(k, j);
  };
  for (const c of ccys) {
    const s = span.get(c);
    if (!s) {
      addJob(start, today, c);
      continue;
    }
    if (s.first > addDays(start, 7)) addJob(start, addDays(s.first, -1), c);
    if (isStale(s.last, today)) addJob(addDays(s.last, 1), today, c);
  }

  if (!jobs.size) return { rows: stored, source: 'stored' };

  const fetched = (
    await Promise.all(Array.from(jobs.values()).map((j) => fetchUsdRates(j.ccys, j.from, j.to)))
  ).flat();

  await writeBack(
    'fx_rates',
    fetched.map((r) => ({ date: r.date, currency: r.currency, usd_per_unit: r.usdPerUnit, source: 'auto' }))
  );

  return { rows: [...stored, ...fetched], source: stored.length ? 'mixed' : 'fetched' };
}

export type HistoryAsset = { key: string; symbol: string; type: string; from: string };

/**
 * Daily closes per asset (keyed by `asset.key`) from each asset's `from` to today.
 * Reads price_history, fills gaps from Yahoo, writes them back. Failed symbols are left out.
 */
export async function loadPriceHistory(
  supabase: SupabaseClient,
  assets: HistoryAsset[]
): Promise<Map<string, PriceSeries>> {
  const out = new Map<string, PriceSeries>();
  if (!assets.length) return out;
  const today = isoDate();
  const bySymbol = new Map(assets.map((a) => [toYahooSymbol(a.symbol, a.type), a]));
  const symbols = Array.from(bySymbol.keys());
  const earliest = assets.reduce((m, a) => (a.from < m ? a.from : m), today);

  let stored: { symbol: string; date: string; close: number; currency: string }[] = [];
  try {
    stored = await selectAll((a, b) =>
      supabase
        .from('price_history')
        .select('symbol, date, close, currency')
        .in('symbol', symbols)
        .gte('date', addDays(earliest, -7))
        .order('date')
        .range(a, b)
    );
  } catch (e) {
    console.error('[prices] history read failed', e instanceof Error ? e.message : e);
  }

  for (const r of stored) {
    const a = bySymbol.get(r.symbol);
    if (!a) continue;
    const s = out.get(a.key) ?? { currency: r.currency, points: [] };
    s.points.push({ date: r.date, close: Number(r.close) });
    out.set(a.key, s);
  }

  const toFetch = symbols.filter((sym) => {
    const a = bySymbol.get(sym)!;
    const pts = out.get(a.key)?.points ?? [];
    if (!pts.length) return true;
    // first stored close well after the first trade means the start is missing
    if (pts[0].date > addDays(a.from, 7)) return true;
    return isStale(pts[pts.length - 1].date, today);
  });

  const results = await Promise.allSettled(
    toFetch.map((sym) => {
      const a = bySymbol.get(sym)!;
      return fetchDailyHistory(a.symbol, a.type, addDays(a.from, -7));
    })
  );

  const rows: Record<string, unknown>[] = [];
  results.forEach((r, i) => {
    const sym = toFetch[i];
    const a = bySymbol.get(sym)!;
    if (r.status !== 'fulfilled') {
      console.error('[prices] history fetch failed for', sym);
      return;
    }
    out.set(a.key, { currency: r.value.currency, points: r.value.points });
    for (const p of r.value.points) {
      rows.push({ symbol: sym, date: p.date, close: p.close, currency: r.value.currency });
    }
  });

  await writeBack('price_history', rows);
  return out;
}
