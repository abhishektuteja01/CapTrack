// src/app/trades/recent-trades.tsx
import { supabaseServer } from '@/lib/db/supabase/server';
import Link from 'next/link';
import DeleteTradeButton from './delete-trade-button';

type TradeRow = {
  id: string;
  occurred_at: string;
  asset_symbol: string;
  asset_type: string;
  side: 'BUY' | 'SELL';
  quantity: string | number;
  price: string | number;
  fees: string | number;
  currency: string;
  notes: string | null;
};

function fmtNumber(n: string | number) {
  const num = typeof n === 'string' ? Number(n) : n;
  return Number.isFinite(num) ? num.toLocaleString(undefined, { maximumFractionDigits: 8 }) : String(n);
}

function fmtMoney(n: string | number, ccy: string) {
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return `${n} ${ccy}`;
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${ccy}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default async function RecentTrades({ portfolioId }: { portfolioId: string }) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('trades')
    .select(
      'id, occurred_at, asset_symbol, asset_type, side, quantity, price, fees, currency, notes',
    )
    .eq('portfolio_id', portfolioId)
    .order('occurred_at', { ascending: false })
    .limit(20);

  if (error) {
    return (
      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Recent trades</div>
        <p className="mt-1 text-sm text-zinc-600">Failed to load trades: {error.message}</p>
      </section>
    );
  }

  const trades = (data ?? []) as TradeRow[];

  if (trades.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-sm font-semibold text-zinc-900">Recent trades</div>
        <p className="mt-1 text-sm text-zinc-600">No trades yet. Add your first trade above.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-zinc-900">Recent trades</h2>
          <p className="mt-0.5 text-xs text-zinc-600">Your latest activity (most recent first)</p>
        </div>
        <span className="text-xs text-zinc-500">Last {trades.length}</span>
      </div>

      <div className="mt-4 space-y-3">
        {/* Mobile-first cards */}
        <div className="grid gap-3 md:hidden">
          {trades.map((t) => (
            <div key={t.id} className="rounded-xl border border-zinc-300 p-3 transition-colors hover:bg-zinc-50 sm:p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-sm font-semibold tracking-tight">{t.asset_symbol}</div>
                    <div className="text-xs text-zinc-500">{t.asset_type}</div>
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-600">{fmtDate(t.occurred_at)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/trades?edit=${t.id}`}
                    className="text-xs text-zinc-600 underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteTradeButton
                    tradeId={t.id}
                    portfolioId={portfolioId}
                    className="text-xs text-zinc-600 underline-offset-2 hover:underline"
                  />
                  <span
                    className={
                      t.side === 'BUY'
                        ? 'rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-900'
                        : 'rounded-md border border-zinc-300 px-2 py-0.5 text-zinc-700'
                    }
                  >
                    {t.side}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-zinc-500">Qty</div>
                  <div className="font-medium tabular-nums">{fmtNumber(t.quantity)}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Price</div>
                  <div className="font-medium tabular-nums">{fmtMoney(t.price, t.currency)}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Fees</div>
                  <div className="font-medium tabular-nums">{fmtMoney(t.fees, t.currency)}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Currency</div>
                  <div className="font-medium">{t.currency}</div>
                </div>
              </div>

              {t.notes ? (
                <div className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-600">
                  {t.notes}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* md+ table */}
        <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Time</th>
                <th className="px-3 py-2 text-left font-medium">Asset</th>
                <th className="px-3 py-2 text-left font-medium">Side</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Fees</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-3 py-2 text-zinc-700">{fmtDate(t.occurred_at)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900">{t.asset_symbol}</div>
                    <div className="text-xs text-zinc-500">{t.asset_type}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        t.side === 'BUY'
                          ? 'rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-900'
                          : 'rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700'
                      }
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(t.quantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(t.price, t.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(t.fees, t.currency)}</td>
                  <td className="px-3 py-2 text-zinc-600">
                    {t.notes ? <span className="line-clamp-2">{t.notes}</span> : ''}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-3">
                      <Link
                        href={`/trades?edit=${t.id}`}
                        className="text-xs text-zinc-600 underline-offset-2 hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteTradeButton
                        tradeId={t.id}
                        portfolioId={portfolioId}
                        className="text-xs text-zinc-600 underline-offset-2 hover:underline"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}