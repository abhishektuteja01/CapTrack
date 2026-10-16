// scripts/refresh-market-data.ts
// Nightly job (GitHub Actions): bring price_history, splits, dividends, NSE F&O settlement prices
// and fx_rates up to date for every asset, benchmark and currency in use.
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY. Run: npx tsx scripts/refresh-market-data.ts

import { supabaseService } from '@/lib/supabase/service';
import { loadMarket, type MarketAsset } from '@/lib/services/market/store';
import { assetKey } from '@/lib/domain/portfolio/positions';

async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const svc = supabaseService()!;
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await svc.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

type T = {
  asset_symbol: string;
  asset_type: string;
  occurred_at: string;
  currency: string;
  fx_quote: string | null;
  underlying: string | null;
  expiry: string | null;
};

async function main() {
  const svc = supabaseService();
  if (!svc) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set');

  const [trades, cash, settings] = await Promise.all([
    selectAll<T>('trades', 'asset_symbol, asset_type, occurred_at, currency, fx_quote, underlying, expiry'),
    selectAll<{ currency: string; occurred_at: string }>('cash_entries', 'currency, occurred_at'),
    selectAll<{ base_currency: string; benchmark: string | null }>('user_settings', 'base_currency, benchmark'),
  ]);

  const assets = new Map<string, MarketAsset>();
  const currencies = new Set<string>();
  let earliest = new Date().toISOString().slice(0, 10);
  for (const t of trades) {
    const key = assetKey(t.asset_symbol, t.asset_type);
    const date = t.occurred_at.slice(0, 10);
    const a = assets.get(key);
    const contract = t.underlying && t.expiry ? { underlying: t.underlying, expiry: t.expiry.slice(0, 10) } : undefined;
    if (!a || date < a.from) assets.set(key, { key, symbol: t.asset_symbol, type: t.asset_type, from: date, contract });
    if (t.currency) currencies.add(t.currency.trim().toUpperCase());
    if (t.fx_quote) currencies.add(t.fx_quote.toUpperCase());
    if (date < earliest) earliest = date;
  }
  for (const c of cash) {
    currencies.add(c.currency.toUpperCase());
    if (c.occurred_at.slice(0, 10) < earliest) earliest = c.occurred_at.slice(0, 10);
  }
  settings.forEach((s) => s.base_currency && currencies.add(s.base_currency.toUpperCase()));
  const benchmarks = Array.from(new Set(settings.map((s) => s.benchmark).filter((b): b is string => Boolean(b))));

  // Await every refresh instead of deferring it.
  const tasks: Promise<unknown>[] = [];
  const background = (task: () => Promise<unknown>) => {
    tasks.push(task());
  };

  const runs = benchmarks.length ? benchmarks : [null];
  let priced = 0;
  for (const [i, benchmark] of runs.entries()) {
    const m = await loadMarket(
      svc,
      { assets: i === 0 ? Array.from(assets.values()) : [], currencies: i === 0 ? Array.from(currencies) : [], since: earliest, benchmark },
      background
    );
    if (i === 0) priced = m.prices.size;
    if (benchmark) console.log(`benchmark ${benchmark}: ${m.benchmark?.points.length ?? 0} closes`);
  }
  const results = await Promise.allSettled(tasks);
  const failed = results.filter((r) => r.status === 'rejected');
  failed.forEach((r) => console.error((r as PromiseRejectedResult).reason));

  console.log(`assets: ${assets.size} (priced ${priced}), currencies: ${currencies.size}, refreshes: ${tasks.length} (${failed.length} failed)`);
  const unpriced = Array.from(assets.values()).filter((a) => a.type === 'other').map((a) => a.symbol);
  if (unpriced.length) console.log(`valued at last trade (type other): ${unpriced.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
