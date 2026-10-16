// src/lib/services/market/store.ts
// Shared market data cache in Supabase: daily closes (price_history), splits, dividends and FX.
// Reads take one round trip (the market_data RPC). Anything missing is fetched before the page
// renders; anything merely stale is refreshed after the response is sent. Writes need the
// service-role client; without it fetched data is still used for the request.

import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UsdRateRow } from '@/lib/domain/fx/rates';
import type { PricePoint, PriceSeries } from '@/lib/domain/portfolio/history';
import type { Contract } from '@/lib/domain/portfolio/positions';
import type { DividendEvent } from '@/lib/domain/portfolio/dividends';
import { detectImpliedSplits, mergeSplits, unadjustForSplits, type Split } from '@/lib/domain/portfolio/splits';
import { underlyingYahooSymbol } from '@/lib/domain/portfolio/contracts';
import { supabaseService } from '@/lib/supabase/service';
import { fetchFrankfurterRange, frankfurterCurrencies } from '@/lib/services/fx/frankfurter';
import { fetchDailyHistory, fetchYahooUsdRateHistory, toYahooSymbol } from '@/lib/services/prices/yahoo';
import { fetchMfHistory, isSchemeCode } from '@/lib/services/prices/mfapi';
import { fetchFoBhavcopy, latestFoBhavcopy, weekdays } from '@/lib/services/prices/nse';

const PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDate(d: Date | number = Date.now()) {
  return new Date(d).toISOString().slice(0, 10);
}

function addDays(date: string, n: number) {
  return isoDate(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS);
}

/** The last weekday before `today`: the newest daily close we can expect to have. */
function lastWeekdayBefore(today: string) {
  let d = addDays(today, -1);
  while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = addDays(d, -1);
  return d;
}

/**
 * Where an asset's prices come from, as stored in price_history.symbol:
 * Yahoo symbol, `MF:<AMFI code>` (mfapi.in) or `NFO:<NSE symbol>` (NSE bhavcopy). Undefined: not priced.
 */
export function sourceId(symbol: string, type: string): string | undefined {
  const s = symbol.toUpperCase().trim();
  if (type === 'future' || type === 'option') return `NFO:${s}`;
  if (type === 'mutual_fund' && isSchemeCode(s)) return `MF:${s}`;
  if (type === 'other') return undefined;
  return toYahooSymbol(s, type);
}

export function sourceName(id: string) {
  return id.startsWith('NFO:') ? 'NSE' : id.startsWith('MF:') ? 'AMFI' : 'Yahoo Finance';
}

async function writeBack(table: 'fx_rates' | 'price_history' | 'price_splits' | 'price_dividends', rows: Record<string, unknown>[]) {
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

type Background = (task: () => Promise<unknown>) => void | Promise<unknown>;

/** Run after the response when inside a request; right away otherwise (scripts, tests). */
function later(task: () => Promise<unknown>) {
  const run = () => task().catch((e) => console.error('[market] background refresh failed', e instanceof Error ? e.message : e));
  try {
    after(run);
  } catch {
    void run();
  }
}

// Background refreshes already started on this server instance, so a busy page doesn't repeat them.
const recently = new Map<string, number>();
function claim(id: string) {
  const now = Date.now();
  if ((recently.get(id) ?? 0) > now - 15 * 60 * 1000) return false;
  recently.set(id, now);
  return true;
}

// ---------- Fetching from sources ----------

type Fetched = { id: string; currency: string; points: PricePoint[]; splits: Split[]; dividends: PricePoint[] };

/**
 * Full history for one Yahoo or mfapi source since `from`, written back to the store.
 * `wait` holds until the rows are saved; otherwise they're saved after the response.
 */
export async function refreshSeries(id: string, from: string, type: string, wait = false): Promise<Fetched> {
  let f: Fetched;
  if (id.startsWith('MF:')) {
    const h = await fetchMfHistory(id.slice(3), from);
    f = { id, currency: h.currency, points: h.points, splits: [], dividends: [] };
  } else {
    // Always refetch a symbol's whole range: Yahoo rewrites past closes after a split,
    // so mixing old and new rows would create a fake jump.
    const h = await fetchDailyHistory(id, type, from);
    f = { id, currency: h.currency, points: h.points, splits: h.splits, dividends: h.dividends };
  }
  const save = () =>
    Promise.all([
      writeBack('price_history', f.points.map((p) => ({ symbol: id, date: p.date, close: p.close, currency: f.currency }))),
      writeBack('price_splits', f.splits.map((s) => ({ symbol: id, date: s.date, ratio: s.ratio }))),
      writeBack('price_dividends', f.dividends.map((d) => ({ symbol: id, date: d.date, amount: d.close }))),
    ]);
  if (wait) await save();
  else later(save);
  return f;
}

/**
 * NSE F&O settlement prices for `ids` (NFO:…) on each of `dates`, written back.
 * Days without a bhavcopy (holidays) are skipped.
 */
export async function refreshContracts(ids: string[], dates: string[]): Promise<Map<string, PricePoint[]>> {
  const want = new Set(ids.map((i) => i.slice(4)));
  const out = new Map<string, PricePoint[]>();
  const rows: Record<string, unknown>[] = [];
  for (const date of dates) {
    const b = await fetchFoBhavcopy(date).catch(() => null);
    if (!b) continue;
    for (const sym of want) {
      const r = b.rows.get(sym);
      if (!r) continue;
      const id = `NFO:${sym}`;
      out.set(id, [...(out.get(id) ?? []), { date, close: r.settle }]);
      rows.push({ symbol: id, date, close: r.settle, currency: 'INR' });
    }
  }
  await writeBack('price_history', rows);
  return out;
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

export async function refreshFx(currencies: string[], from: string, to: string, wait = false): Promise<UsdRateRow[]> {
  const rows = await fetchUsdRates(currencies, from, to);
  const save = () => writeBack('fx_rates', rows.map((r) => ({ date: r.date, currency: r.currency, usd_per_unit: r.usdPerUnit, source: 'auto' })));
  if (wait) await save();
  else later(save);
  return rows;
}

// ---------- Reading ----------

export type MarketAsset = { key: string; symbol: string; type: string; from: string; contract?: Contract };

export type MarketData = {
  /** Closes as actually traded (split adjustments undone), keyed by asset key. */
  prices: Map<string, PriceSeries>;
  /** Reported and detected splits per asset key, ascending. */
  splits: Map<string, Split[]>;
  /** Per-share dividends per asset key, as paid (not split-adjusted). */
  dividends: Map<string, { currency: string; events: DividendEvent[] }>;
  fx: UsdRateRow[];
  benchmark?: PriceSeries;
  /** Spot closes of F&O underlyings, keyed by underlying name, for settling expired contracts. */
  underlyings: Map<string, PriceSeries>;
  /** Source id per asset key. */
  sources: Map<string, string>;
};

type Raw = {
  prices: [string, string, number, string][];
  splits: [string, string, number][];
  dividends: [string, string, number][];
  fx: [string, string, number][];
};

async function readStore(supabase: SupabaseClient, ids: string[], currencies: string[], since: string): Promise<Raw> {
  const empty: Raw = { prices: [], splits: [], dividends: [], fx: [] };
  if (!ids.length && !currencies.length) return empty;
  const { data, error } = await supabase.rpc('market_data', { p_symbols: ids, p_currencies: currencies, p_since: since });
  if (error) {
    console.error('[market] read failed', error.message);
    return empty;
  }
  return (data as Raw) ?? empty;
}

/** Reported splits for these assets (one query, no fetching), keyed by asset key. */
export async function loadSplits(supabase: SupabaseClient, assets: { key: string; symbol: string; type: string }[]): Promise<Map<string, Split[]>> {
  const ids = new Map<string, string[]>();
  for (const a of assets) {
    const id = sourceId(a.symbol, a.type);
    if (id && !id.includes(':')) ids.set(id, [...(ids.get(id) ?? []), a.key]);
  }
  const out = new Map<string, Split[]>();
  if (!ids.size) return out;
  const { data } = await supabase.from('price_splits').select('symbol, date, ratio').in('symbol', Array.from(ids.keys())).order('date');
  for (const r of data ?? []) {
    for (const key of ids.get(String(r.symbol)) ?? []) {
      out.set(key, [...(out.get(key) ?? []), { date: String(r.date), ratio: Number(r.ratio), source: 'yahoo' }]);
    }
  }
  return out;
}

/** FX rows for `currencies` since `from`, fetching what the store lacks. */
export async function loadFx(supabase: SupabaseClient, currencies: string[], from: string): Promise<UsdRateRow[]> {
  const ccys = Array.from(new Set(currencies.map((c) => c.toUpperCase()))).filter((c) => c !== 'USD');
  const raw = await readStore(supabase, [], ccys, addDays(from, -7));
  return fillFx(raw.fx, ccys, from);
}

async function fillFx(stored: Raw['fx'], ccys: string[], from: string, background: Background = later): Promise<UsdRateRow[]> {
  const today = isoDate();
  const start = addDays(from, -7);
  const rows: UsdRateRow[] = stored.map(([currency, date, v]) => ({ currency, date, usdPerUnit: Number(v) }));
  const span = new Map<string, { first: string; last: string }>();
  for (const r of rows) {
    const s = span.get(r.currency);
    if (!s) span.set(r.currency, { first: r.date, last: r.date });
    else {
      if (r.date < s.first) s.first = r.date;
      if (r.date > s.last) s.last = r.date;
    }
  }
  const missing: string[] = [];
  const gaps: { c: string; from: string; to: string }[] = [];
  const stale: string[] = [];
  for (const c of ccys) {
    const s = span.get(c);
    if (!s) missing.push(c);
    else if (s.first > addDays(start, 7)) gaps.push({ c, from: start, to: addDays(s.first, -1) });
    else if (s.last < lastWeekdayBefore(today)) stale.push(c);
  }
  if (missing.length) rows.push(...(await refreshFx(missing, start, today).catch(() => [])));
  for (const g of gaps) rows.push(...(await refreshFx([g.c], g.from, g.to).catch(() => [])));
  const due = stale.filter((c) => claim(`fx:${c}`));
  if (due.length) background(() => refreshFx(due, addDays(lastWeekdayBefore(today), -7), today, true));
  return rows;
}

/**
 * Everything a portfolio needs, one store read plus fetches for what's missing:
 * daily closes, splits and dividends per asset, FX for `currencies`, an optional benchmark series.
 */
export async function loadMarket(
  supabase: SupabaseClient,
  args: { assets: MarketAsset[]; currencies: string[]; since: string; benchmark?: string | null },
  /** How stale data is refreshed: after the response by default; the nightly job awaits it. */
  background: Background = later
): Promise<MarketData> {
  const today = isoDate();
  const since = addDays(args.since, -7);
  const sources = new Map<string, string>();
  const byId = new Map<string, MarketAsset & { id: string }>();
  for (const a of args.assets) {
    const id = sourceId(a.symbol, a.type);
    if (!id) continue;
    sources.set(a.key, id);
    const prev = byId.get(id);
    if (!prev || a.from < prev.from) byId.set(id, { ...a, id });
  }
  // Expired contracts need their underlying's close on expiry if NSE's settlement price is missing.
  const expired = args.assets.filter((a) => a.contract && a.contract.expiry < today);
  const underlyingIds = new Map(expired.map((a) => [a.contract!.underlying, underlyingYahooSymbol(a.contract!.underlying)]));
  const bench = args.benchmark?.trim().toUpperCase() || undefined;
  const ids = [...byId.keys(), ...underlyingIds.values(), ...(bench ? [bench] : [])];
  const ccys = Array.from(new Set(args.currencies.map((c) => c.toUpperCase()))).filter((c) => c !== 'USD');

  const raw = await readStore(supabase, Array.from(new Set(ids)), ccys, since);

  const series = new Map<string, { currency: string; points: PricePoint[] }>();
  for (const [sym, date, close, currency] of raw.prices) {
    const s = series.get(sym) ?? { currency, points: [] };
    s.points.push({ date, close: Number(close) });
    series.set(sym, s);
  }
  const reported = new Map<string, Split[]>();
  for (const [sym, date, ratio] of raw.splits) {
    reported.set(sym, [...(reported.get(sym) ?? []), { date, ratio: Number(ratio), source: 'yahoo' }]);
  }
  const divs = new Map<string, PricePoint[]>();
  for (const [sym, date, amount] of raw.dividends) divs.set(sym, [...(divs.get(sym) ?? []), { date, close: Number(amount) }]);

  // Fill gaps. Anything with no rows at all is fetched now; stale series refresh in the background.
  const expect = lastWeekdayBefore(today);
  const missing: (MarketAsset & { id: string })[] = [];
  const stale: (MarketAsset & { id: string })[] = [];
  const nfoMissing: string[] = [];
  const nfoStale: { id: string; from: string; to: string }[] = [];
  const extra: (MarketAsset & { id: string })[] = [...underlyingIds.values(), ...(bench ? [bench] : [])].map((id) => ({ key: id, symbol: id, type: 'index', from: args.since, id }));
  for (const a of [...byId.values(), ...extra]) {
    const pts = series.get(a.id)?.points ?? [];
    const first = pts[0]?.date;
    const last = pts[pts.length - 1]?.date;
    if (a.id.startsWith('NFO:')) {
      const end = a.contract && a.contract.expiry < today ? a.contract.expiry : expect;
      if (!pts.length) nfoMissing.push(a.id);
      if (!last || last < end || (first && first > addDays(a.from, 5))) nfoStale.push({ id: a.id, from: a.from.slice(0, 10), to: end });
      continue;
    }
    const crypto = a.type === 'crypto';
    if (!pts.length || (first && first > addDays(a.from, 7))) missing.push(a);
    else if (last && last < (crypto ? addDays(today, -1) : expect)) stale.push(a);
  }

  const fetched = await Promise.allSettled(missing.map((a) => refreshSeries(a.id, addDays(a.from, -7), a.type)));
  fetched.forEach((r, i) => {
    if (r.status !== 'fulfilled') {
      console.error('[market] history fetch failed for', missing[i].id);
      return;
    }
    const f = r.value;
    series.set(f.id, { currency: f.currency, points: f.points });
    reported.set(f.id, mergeSplits(reported.get(f.id) ?? [], f.splits));
    divs.set(f.id, f.dividends);
  });

  // A contract we've never priced gets today's mark from the latest bhavcopy right away.
  if (nfoMissing.length) {
    const b = await latestFoBhavcopy(today).catch(() => null);
    if (b) {
      for (const id of nfoMissing) {
        const r = b.rows.get(id.slice(4));
        if (r) series.set(id, { currency: 'INR', points: [{ date: b.date, close: r.settle }] });
      }
    }
  }

  const dueSeries = stale.filter((a) => claim(a.id));
  if (dueSeries.length) background(() => Promise.allSettled(dueSeries.map((a) => refreshSeries(a.id, addDays(a.from, -7), a.type, true))));
  const dueNfo = nfoStale.filter((n) => claim(n.id));
  if (dueNfo.length) {
    background(async () => {
      // Backfill at most ~3 months of trading days per contract per run.
      const have = (id: string) => new Set((series.get(id)?.points ?? []).map((p) => p.date));
      const dates = new Set<string>();
      for (const n of dueNfo) for (const d of weekdays(n.from, n.to).slice(-65)) if (!have(n.id).has(d)) dates.add(d);
      await refreshContracts(dueNfo.map((n) => n.id), Array.from(dates).sort());
    });
  }

  const fxRows = await fillFx(raw.fx, ccys, args.since, background);

  // Shape per asset key. Yahoo closes are split-adjusted; undo it so replay sees traded prices.
  const prices = new Map<string, PriceSeries>();
  const splits = new Map<string, Split[]>();
  const dividends = new Map<string, { currency: string; events: DividendEvent[] }>();
  for (const [key, id] of sources) {
    const s = series.get(id);
    if (!s) continue;
    s.points.sort((a, b) => (a.date < b.date ? -1 : 1));
    const yahoo = !id.includes(':');
    const rep = reported.get(id) ?? [];
    prices.set(key, { currency: s.currency, points: yahoo ? unadjustForSplits(s.points, rep) : s.points });
    const all = yahoo ? mergeSplits(rep, detectImpliedSplits(s.points)) : [];
    if (all.length) splits.set(key, all);
    const d = divs.get(id);
    if (d?.length) dividends.set(key, { currency: s.currency, events: d.map((p) => ({ date: p.date, amount: p.close })) });
  }
  const underlyings = new Map<string, PriceSeries>();
  for (const [name, id] of underlyingIds) {
    const s = series.get(id);
    if (s) underlyings.set(name, s);
  }
  const b = bench ? series.get(bench) : undefined;

  return { prices, splits, dividends, fx: fxRows, benchmark: b, underlyings, sources };
}
