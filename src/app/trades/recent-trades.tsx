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
  platform: string | null;
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
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function platformLabel(p: string | null | undefined) {
  const v = (p ?? '').trim();
  return v.length ? v : 'Manual';
}

function sideBadgeClass(side: 'BUY' | 'SELL') {
  return side === 'BUY'
    ? 'rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700'
    : 'rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700';
}

export default async function RecentTrades({
  portfolioId,
  page,
}: {
  portfolioId: string;
  page: number;
}) {
  const pageSize = 5;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await supabaseServer();

  const { count: totalCount, error: countError } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('portfolio_id', portfolioId);

  if (countError) {
    return (
      <section className="mt-8 bg-white p-4 border border-zinc-200 rounded-xl md:border-0 md:rounded-none">
        <div className="text-sm font-semibold text-zinc-900">Recent trades</div>
        <p className="mt-1 text-sm text-zinc-600">Failed to load trades: {countError.message}</p>
      </section>
    );
  }

  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const safeFrom = (safePage - 1) * pageSize;
  const safeTo = safeFrom + pageSize - 1;

  const { data, error } = await supabase
    .from('trades')
    .select(
      'id, occurred_at, asset_symbol, asset_type, side, quantity, price, fees, currency, platform, notes',
    )
    .eq('portfolio_id', portfolioId)
    .order('occurred_at', { ascending: false })
    .range(safeFrom, safeTo);

  if (error) {
    return (
      <section className="mt-8 bg-white p-4 border border-zinc-200 rounded-xl md:border-0 md:rounded-none">
        <div className="text-sm font-semibold text-zinc-900">Recent trades</div>
        <p className="mt-1 text-sm text-zinc-600">Failed to load trades: {error.message}</p>
      </section>
    );
  }

  const trades = (data ?? []) as TradeRow[];

  if (trades.length === 0) {
    return (
      <section className="mt-8 bg-white p-4 border border-zinc-200 rounded-xl md:border-0 md:rounded-none">
        <div className="text-sm font-semibold text-zinc-900">Recent trades</div>
        <p className="mt-1 text-sm text-zinc-600">No trades yet. Add your first trade.</p>
      </section>
    );
  }

  return (
    <section className="mt-8 w-full bg-white md:border-0 md:rounded-none">
      <div className="flex items-end justify-between border-b border-zinc-200 px-6 py-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-zinc-900">Recent trades</h2>
          <p className="mt-0.5 text-xs text-zinc-600">Your latest activity (most recent first)</p>
        </div>
        <span className="text-xs text-zinc-500">
          Page {safePage} of {totalPages}
        </span>
      </div>

      <div className="px-6 pb-4 pt-3">
        {/* Mobile-first cards */}
        <div className="grid gap-3 md:hidden">
          {trades.map((t) => (
            <div key={t.id} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition-colors hover:bg-zinc-50 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-bold tracking-tight text-zinc-900">{t.asset_symbol}</div>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                    {t.asset_type}
                  </span>
                </div>
                <span className={sideBadgeClass(t.side)}>{t.side}</span>
              </div>
              <div className="mt-0.5 text-xs text-zinc-600">
                {platformLabel(t.platform)} · {fmtDate(t.occurred_at)}
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

              <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 leading-none">
                <Link
                  href={`/trades/${t.id}/edit`}
                  className="text-xs leading-none text-zinc-600 underline-offset-2 hover:underline"
                >
                  Edit
                </Link>
                <DeleteTradeButton
                  tradeId={t.id}
                  portfolioId={portfolioId}
                  className="text-xs leading-none font-semibold text-rose-600 underline-offset-2 hover:underline"
                />
              </div>
            </div>
          ))}
        </div>

        {/* md+ table */}
        <div className="hidden md:block">
          <div className="w-full overflow-x-auto flex justify-center">
            <div className="inline-block overflow-hidden rounded-2xl border border-zinc-200 align-top">
              <table className="min-w-max table-auto border-collapse text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-2 py-2 text-left font-medium lg:px-3">Date</th>
                <th className="px-2 py-2 text-left font-medium lg:px-3">Asset</th>
                <th className="px-2 py-2 text-left font-medium lg:px-3">Platform</th>
                <th className="px-2 py-2 text-left font-medium lg:px-3">Side</th>
                <th className="px-2 py-2 text-right font-medium lg:px-3">Qty</th>
                <th className="px-2 py-2 text-right font-medium lg:px-3">Price</th>
                <th className="px-2 py-2 text-right font-medium lg:px-3">Fees</th>
                <th className="px-2 py-2 text-left font-medium lg:px-3">Notes</th>
                <th className="px-2 py-2 text-right font-medium whitespace-nowrap lg:px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-zinc-200 hover:bg-zinc-50 even:bg-white odd:bg-zinc-50/30"
                >
                  <td className="px-2 py-2 text-zinc-700 lg:px-3">{fmtDate(t.occurred_at)}</td>
                  <td className="px-2 py-2 lg:px-3">
                    <div className="font-medium text-zinc-900">{t.asset_symbol}</div>
                    <div className="text-xs text-zinc-500">{t.asset_type}</div>
                  </td>
                  <td className="px-2 py-2 lg:px-3">
                    <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-700">
                      {platformLabel(t.platform)}
                    </span>
                  </td>
                  <td className="px-2 py-2 lg:px-3">
                    <span className={sideBadgeClass(t.side)}>{t.side}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums lg:px-3">{fmtNumber(t.quantity)}</td>
                  <td className="px-2 py-2 text-right tabular-nums lg:px-3">{fmtMoney(t.price, t.currency)}</td>
                  <td className="px-2 py-2 text-right tabular-nums lg:px-3">{fmtMoney(t.fees, t.currency)}</td>
                  <td className="px-2 py-2 text-zinc-600 lg:px-3">
                    {t.notes ? (
                      <span className="block max-w-[28rem] whitespace-normal break-words line-clamp-2">
                        {t.notes}
                      </span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap lg:px-3">
                    <div className="inline-flex items-center gap-3 whitespace-nowrap leading-none">
                      <Link
                        href={`/trades/${t.id}/edit`}
                        className="text-xs leading-none text-zinc-600 underline-offset-2 hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteTradeButton
                        tradeId={t.id}
                        portfolioId={portfolioId}
                        className="text-xs leading-none text-zinc-600 underline-offset-2 hover:underline"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
              </table>
            </div>
          </div>
        </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link
          href={safePage > 1 ? `/trades?page=${safePage - 1}` : `/trades?page=1`}
          aria-disabled={safePage <= 1}
          className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-semibold ${
            safePage <= 1
              ? 'border-zinc-200 text-zinc-400 cursor-not-allowed'
              : 'border-zinc-300 text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          Prev
        </Link>

        <div className="text-xs text-zinc-600 tabular-nums">
          {total === 0 ? '0 trades' : `${safeFrom + 1}-${Math.min(safeTo + 1, total)} of ${total}`}
        </div>

        <Link
          href={safePage < totalPages ? `/trades?page=${safePage + 1}` : `/trades?page=${totalPages}`}
          aria-disabled={safePage >= totalPages}
          className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-semibold ${
            safePage >= totalPages
              ? 'border-zinc-200 text-zinc-400 cursor-not-allowed'
              : 'border-zinc-300 text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          Next
        </Link>
      </div>

      </div>
    </section>
  );
}