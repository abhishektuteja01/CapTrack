import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/db/supabase/server';
import { derivePositions } from '@/lib/domain/portfolio/positions';
import { fetchYahooPrices, toYahooSymbol } from '@/lib/services/prices/yahoo';

export default async function DashboardPage() {
  async function refreshDashboard() {
    'use server';
    revalidatePath('/dashboard');
  }

  const supabase = await supabaseServer();

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1);

  const portfolio = portfolios?.[0];

  if (!portfolio) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">No portfolio found.</p>
      </div>
    );
  }

  const { data: trades } = await supabase
    .from('trades')
    .select(
      'occurred_at, asset_symbol, asset_type, side, quantity, price, fees, currency'
    )
    .eq('portfolio_id', portfolio.id);

  const positions = derivePositions(
    (trades ?? []).map((t) => ({
      occurredAt: t.occurred_at,
      asset: { symbol: t.asset_symbol, type: t.asset_type },
      side: t.side,
      quantity: Number(t.quantity),
      price: Number(t.price),
      fees: Number(t.fees),
      currency: t.currency,
    }))
  );

  const fmtMoney = (n: number, ccy?: string) => {
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    const formatted = abs >= 1
      ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return ccy ? `${formatted} ${ccy}` : formatted;
  };

  const fmtQty = (n: number) => {
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) >= 1)
      return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return n.toLocaleString(undefined, { maximumFractionDigits: 10 });
  };

  const quotes = await fetchYahooPrices(
    positions.map((p) => ({
      symbol: p.asset.symbol,
      assetType: String(p.asset.type),
    }))
  );

  const quoteByYahooSymbol = new Map(
    quotes.map((q) => [q.symbol.toUpperCase(), q])
  );

  const enriched = positions.map((p) => {
    const yahooSymbol = toYahooSymbol(
      p.asset.symbol,
      String(p.asset.type)
    ).toUpperCase();
    const q = quoteByYahooSymbol.get(yahooSymbol);

    const price = q?.price;
    const ccy = q?.currency ?? p.currency;
    const displayName = q?.name;

    const marketValue = typeof price === 'number' ? p.quantity * price : undefined;
    const unrealized =
      typeof marketValue === 'number' ? marketValue - p.costBasis : undefined;
    const unrealizedPct =
      typeof unrealized === 'number' && p.costBasis !== 0
        ? unrealized / p.costBasis
        : undefined;

    return {
      ...p,
      yahooSymbol,
      displayName,
      livePrice: price,
      liveCurrency: ccy,
      marketValue,
      unrealized,
      unrealizedPct,
      quoteTimestamp: q?.timestamp,
    };
  });

  const totals = enriched.reduce(
    (acc, p) => {
      if (typeof p.marketValue === 'number') acc.marketValue += p.marketValue;
      acc.costBasis += p.costBasis;
      if (typeof p.unrealized === 'number') acc.unrealized += p.unrealized;
      return acc;
    },
    { marketValue: 0, costBasis: 0, unrealized: 0 }
  );

  const totalsPct = totals.costBasis !== 0 ? totals.unrealized / totals.costBasis : 0;

  const pnlClass = (n?: number) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n === 0) return 'text-zinc-900';
    return n > 0 ? 'text-emerald-600' : 'text-rose-600';
  };

  const pnlBgClass = (n?: number) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n === 0) return 'bg-zinc-100 text-zinc-700';
    return n > 0 ? 'bg-emerald-600/15 text-emerald-700' : 'bg-rose-600/15 text-rose-700';
  };

  const primaryCurrency = enriched.find((p) => p.liveCurrency)?.liveCurrency ?? enriched.find((p) => p.currency)?.currency;

  return (
    <div className="space-y-4">
      <section className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-xs text-zinc-500">
            {portfolio.name} • {enriched.length} assets
          </p>
        </div>

        <form action={refreshDashboard}>
          <button
            type="submit"
            aria-label="Refresh prices"
            title="Refresh prices"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm text-zinc-900 hover:bg-zinc-100"
          >
            ⟳
          </button>
        </form>
      </section>

      {/* Summary block */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-zinc-500">Invested</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {fmtMoney(totals.costBasis, primaryCurrency)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Current</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {fmtMoney(totals.marketValue, primaryCurrency)}
            </div>
          </div>
        </div>

        <div className="my-4 h-px w-full bg-zinc-200" />

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-zinc-500">P&amp;L</div>
          <div className="flex items-center gap-2">
            <div className={`text-2xl font-semibold tabular-nums ${pnlClass(totals.unrealized)}`}>
              {totals.unrealized >= 0 ? '+' : ''}
              {fmtMoney(totals.unrealized, primaryCurrency)}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${pnlBgClass(totals.unrealized)}`}>
              {(totalsPct * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </section>

      {/* Positions list */}
      <section className="rounded-2xl border border-zinc-200 bg-white">
        {enriched.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">No positions yet. Add trades to get started.</div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {enriched.map((p) => {
              const ltpPct = typeof p.avgCost === 'number' && p.avgCost !== 0 && typeof p.livePrice === 'number'
                ? (p.livePrice - p.avgCost) / p.avgCost
                : undefined;

              return (
                <li key={`${p.asset.type}:${p.asset.symbol}`} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side */}
                    <div className="min-w-0">
                      <div className="text-xs text-zinc-500">
                        Qty. {fmtQty(p.quantity)} • Avg. {fmtMoney(p.avgCost, p.liveCurrency ?? p.currency)}
                      </div>
                      <div className="mt-1 truncate text-lg font-bold tracking-tight text-zinc-900">
                        {p.asset.symbol}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Invested {fmtMoney(p.costBasis, p.liveCurrency ?? p.currency)}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="shrink-0 text-right">
                      <div className={`text-xs font-semibold tabular-nums ${pnlClass(p.unrealized)}`}>
                        {typeof p.unrealizedPct === 'number' ? `${(p.unrealizedPct * 100).toFixed(2)}%` : '—'}
                      </div>
                      <div className={`mt-1 text-lg font-bold tabular-nums ${pnlClass(p.unrealized)}`}>
                        {typeof p.unrealized === 'number' ? (
                          <>
                            {p.unrealized >= 0 ? '+' : ''}
                            {fmtMoney(p.unrealized, p.liveCurrency ?? p.currency)}
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 tabular-nums">
                        LTP{' '}
                        {typeof p.livePrice === 'number'
                          ? fmtMoney(p.livePrice, p.liveCurrency ?? p.currency)
                          : '—'}
                        {typeof ltpPct === 'number' ? (
                          <span>
                            {' '}
                            ({(ltpPct * 100).toFixed(2)}%)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Optional name under ticker (subtle) */}
                  {p.displayName ? (
                    <div className="mt-2 truncate text-xs text-zinc-600">{p.displayName}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-700">Next: filters (Equity/Crypto), allocation chart, and per-asset details.</p>
        <div className="mt-3">
          <Link
            href="/trades"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Manage trades
          </Link>
        </div>
      </section>
    </div>
  );
}
