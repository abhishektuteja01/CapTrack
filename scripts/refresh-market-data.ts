// scripts/refresh-market-data.ts
// Nightly job (GitHub Actions): fill fx_rates and price_history for every symbol and currency in use.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Run: npx tsx scripts/refresh-market-data.ts

import { supabaseService } from '@/lib/supabase/service';
import { loadPriceHistory, loadUsdRates } from '@/lib/services/market/store';
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

async function main() {
  const svc = supabaseService();
  if (!svc) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

  const trades = await selectAll<{ asset_symbol: string; asset_type: string; occurred_at: string; currency: string }>(
    'trades',
    'asset_symbol, asset_type, occurred_at, currency'
  );
  const settings = await selectAll<{ base_currency: string }>('user_settings', 'base_currency');

  const assets = new Map<string, { key: string; symbol: string; type: string; from: string }>();
  const currencies = new Set<string>();
  let earliest = new Date().toISOString().slice(0, 10);

  for (const t of trades) {
    const key = assetKey(t.asset_symbol, t.asset_type);
    const date = t.occurred_at.slice(0, 10);
    const a = assets.get(key);
    if (!a || date < a.from) assets.set(key, { key, symbol: t.asset_symbol, type: t.asset_type, from: date });
    if (t.currency) currencies.add(t.currency.toUpperCase());
    if (date < earliest) earliest = date;
  }
  settings.forEach((s) => s.base_currency && currencies.add(s.base_currency.toUpperCase()));

  const prices = await loadPriceHistory(svc, Array.from(assets.values()));
  prices.forEach((s) => currencies.add(s.currency));
  const fx = await loadUsdRates(svc, Array.from(currencies), earliest);

  console.log(
    `assets: ${assets.size} (priced ${prices.size}), currencies: ${currencies.size}, fx rows: ${fx.rows.length} (${fx.source})`
  );
  const failed = Array.from(assets.keys()).filter((k) => !prices.has(k));
  if (failed.length) console.log(`no history for: ${failed.join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
