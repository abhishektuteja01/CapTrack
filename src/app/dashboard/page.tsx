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
    const num = Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(6);
    return ccy ? `${num} ${ccy}` : num;
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

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600">
          Positions derived from trades in{' '}
          <span className="font-medium text-zinc-900">{portfolio.name}</span>.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-end justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-900">Positions</h2>
            <form action={refreshDashboard}>
              <button
                type="submit"
                aria-label="Refresh prices"
                title="Refresh prices"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm text-zinc-900 hover:bg-zinc-100"
              >
                ⟳
              </button>
            </form>
          </div>
          <span className="text-xs text-zinc-500">{enriched.length} assets</span>
        </div>

        {enriched.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No positions yet. Add trades to get started.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Asset</th>
                  <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                  <th className="px-3 py-2 text-right font-semibold">Avg cost</th>
                  <th className="px-3 py-2 text-right font-semibold">Cost basis</th>
                  <th className="px-3 py-2 text-right font-semibold">Price</th>
                  <th className="px-3 py-2 text-right font-semibold">Market value</th>
                  <th className="px-3 py-2 text-right font-semibold">Unrealized P/L</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((p) => (
                  <tr
                    key={`${p.asset.type}:${p.asset.symbol}`}
                    className="border-t border-zinc-200"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-900">{p.asset.symbol}</div>
                      <div className="text-xs text-zinc-600">
                        {p.displayName ?? p.asset.type}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtQty(p.quantity)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(p.avgCost, p.liveCurrency ?? p.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(p.costBasis, p.liveCurrency ?? p.currency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {typeof p.livePrice === 'number'
                        ? fmtMoney(p.livePrice, p.liveCurrency)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {typeof p.marketValue === 'number'
                        ? fmtMoney(p.marketValue, p.liveCurrency)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {typeof p.unrealized === 'number' ? (
                        <span
                          className={
                            p.unrealized >= 0 ? 'text-zinc-900' : 'text-zinc-700'
                          }
                        >
                          {fmtMoney(p.unrealized, p.liveCurrency)}
                          {typeof p.unrealizedPct === 'number' ? (
                            <span className="ml-1 text-xs text-zinc-500">
                              ({(p.unrealizedPct * 100).toFixed(2)}%)
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}

                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td className="px-3 py-2 font-semibold text-zinc-900" colSpan={3}>
                    Totals
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {fmtMoney(totals.costBasis)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">—</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {fmtMoney(totals.marketValue)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {fmtMoney(totals.unrealized)}
                    <span className="ml-1 text-xs text-zinc-500">
                      ({(totalsPct * 100).toFixed(2)}%)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="font-semibold text-zinc-900">Next steps</div>
        <p className="mt-1 text-sm text-zinc-700">
          Live prices ✅ → unrealized P/L ✅ → allocation charts.
        </p>
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
