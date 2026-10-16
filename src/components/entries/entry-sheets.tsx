import { supabaseServer } from '@/lib/supabase/server';
import { loadLedger } from '@/lib/portfolio';
import { loadCash, loadTrade, openAccounts } from '@/lib/trades';
import { loadSplits } from '@/lib/services/market/store';
import { assetKey } from '@/lib/domain/portfolio/positions';
import { CASH_KINDS, type CashKind } from '@/lib/domain/portfolio/money';
import { closeHref } from '@/lib/sheet-links';
import { CashSheet, TradeSheet } from '@/components/trades/trade-sheet';

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * The add/edit panels for any page, driven by the URL:
 * ?trade=new (with f_symbol, f_type, f_side, f_platform, f_qty) or ?trade=<id>; ?cash=new (with f_kind,
 * f_symbol, f_platform, f_amount, f_currency, f_date) or ?cash=<id>. Build links with `sheetHref`. Renders nothing when neither is set.
 */
export async function EntrySheets({ basePath, searchParams }: { basePath: string; searchParams: SearchParams }) {
  const trade = first(searchParams.trade);
  const cash = first(searchParams.cash);
  if (!trade && !cash) return null;

  const supabase = await supabaseServer();
  const ledger = await loadLedger(supabase);
  const keys = new Map(ledger.trades.map((t) => [assetKey(t.asset.symbol, t.asset.type), t]));
  const splits = await loadSplits(
    supabase,
    Array.from(keys, ([key, t]) => ({ key, symbol: t.asset.symbol, type: String(t.asset.type) }))
  );
  const holdings = openAccounts(ledger.trades, ledger.settings.costMethod, splits);
  const close = closeHref(basePath, searchParams);
  const common = { platforms: ledger.platforms, baseCurrency: ledger.baseCurrency, holdings, closeHref: close };

  if (trade) {
    const editing = trade === 'new' ? null : await loadTrade(supabase, trade);
    const side = first(searchParams.f_side);
    return (
      <TradeSheet
        key={editing?.id ?? `new-${first(searchParams.f_symbol) ?? ''}-${side ?? ''}`}
        {...common}
        trade={editing ?? undefined}
        costMethod={ledger.settings.costMethod}
        prefill={{
          symbol: first(searchParams.f_symbol)?.toUpperCase(),
          assetType: first(searchParams.f_type),
          side: side === 'SELL' ? 'SELL' : side === 'BUY' ? 'BUY' : undefined,
          platform: first(searchParams.f_platform),
          quantity: num(first(searchParams.f_qty)),
        }}
      />
    );
  }

  const editing = cash === 'new' ? null : await loadCash(supabase, cash!);
  const kind = first(searchParams.f_kind);
  return (
    <CashSheet
      key={editing?.id ?? `new-${kind ?? ''}-${first(searchParams.f_symbol) ?? ''}`}
      {...common}
      entry={editing ?? undefined}
      prefill={{
        kind: (CASH_KINDS as string[]).includes(kind ?? '') ? (kind as CashKind) : undefined,
        symbol: first(searchParams.f_symbol)?.toUpperCase(),
        assetType: first(searchParams.f_type),
        platform: first(searchParams.f_platform),
        amount: num(first(searchParams.f_amount)),
        currency: first(searchParams.f_currency)?.toUpperCase(),
        date: first(searchParams.f_date),
      }}
    />
  );
}
