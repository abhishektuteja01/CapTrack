// src/app/trades/page.tsx
import { supabaseServer } from '@/lib/db/supabase/server';
import TradeForm from './trade-form';
import RecentTrades from './recent-trades';

export default async function TradesPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  const supabase = await supabaseServer();

  // For v1 we just grab the first portfolio.
  // Later: allow selecting portfolios, per-user portfolios, etc.
  const { data: portfolios, error } = await supabase
    .from('portfolios')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Trades</h1>
        <p>Failed to load portfolios: {error.message}</p>
      </div>
    );
  }

  const portfolio = portfolios?.[0];

  if (!portfolio) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Trades</h1>
        <p>No portfolio found. Create a “Main” portfolio row in Supabase first.</p>
      </div>
    );
  }

  const sp = searchParams ? await searchParams : undefined;
  const editId = sp?.edit;

  let editTrade:
    | {
        id: string;
        occurredAtLocal: string;
        symbol: string;
        assetType: string;
        side: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        fees: number;
        currency: string;
        notes: string | null;
      }
    | undefined;

  if (editId) {
    const { data: t } = await supabase
      .from('trades')
      .select(
        'id, occurred_at, asset_symbol, asset_type, side, quantity, price, fees, currency, notes'
      )
      .eq('id', editId)
      .eq('portfolio_id', portfolio.id)
      .maybeSingle();

    if (t) {
      const d = new Date(t.occurred_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      const occurredAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

      editTrade = {
        id: t.id,
        occurredAtLocal,
        symbol: t.asset_symbol,
        assetType: t.asset_type,
        side: t.side,
        quantity: Number(t.quantity),
        price: Number(t.price),
        fees: Number(t.fees),
        currency: t.currency,
        notes: t.notes,
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
            <p className="text-sm text-zinc-600">
              Adding trades into: <span className="font-medium text-zinc-900">{portfolio.name}</span>
            </p>
          </div>

          {editTrade ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
              <div className="font-medium text-zinc-900">Editing trade</div>
              <div className="mt-0.5 text-zinc-600">{editTrade.symbol}</div>
            </div>
          ) : null}
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            {editTrade ? 'Edit trade' : 'Add a trade'}
          </h2>
          <p className="text-xs text-zinc-500">All fields saved to Supabase</p>
        </div>
        <TradeForm
          key={editTrade?.id ?? 'new'}
          portfolioId={portfolio.id}
          editTrade={editTrade}
        />
      </section>

      <RecentTrades portfolioId={portfolio.id} />
    </div>
  );
}