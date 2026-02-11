// src/app/trades/recent-trades.tsx
import { supabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';
import DeleteTradeButton from './delete-trade-button';
import { FadeIn } from '../ui/fade-in';
import { ArrowDown, ArrowUp } from 'lucide-react';

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
    ? 'rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
    : 'rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/20 dark:text-rose-400';
}

type SortField = 'date' | 'asset' | 'qty' | 'price';
type SortOrder = 'asc' | 'desc';

function parseSort(sortStr?: string | string[]): { field: SortField; order: SortOrder } {
  const s = Array.isArray(sortStr) ? sortStr[0] : sortStr;
  if (!s) return { field: 'date', order: 'desc' };

  const [field, order] = s.split(':');
  const safeField = (['date', 'asset', 'qty', 'price'].includes(field) ? field : 'date') as SortField;
  const safeOrder = (order === 'asc' ? 'asc' : 'desc') as SortOrder;

  return { field: safeField, order: safeOrder };
}

function SortHeader({
  label,
  field,
  currentSort,
  search
}: {
  label: string;
  field: SortField;
  currentSort: { field: SortField; order: SortOrder };
  search?: string | string[];
}) {
  const isActive = currentSort.field === field;
  const nextOrder = isActive && currentSort.order === 'desc' ? 'asc' : 'desc';
  const href = `/trades?${new URLSearchParams({
    ...(search ? { search: String(search) } : {}),
    sort: `${field}:${nextOrder}`
  }).toString()}`;

  return (
    <Link href={href} className="group inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200">
      {label}
      <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
        {isActive && currentSort.order === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )}
      </span>
    </Link>
  );
}

export default async function RecentTrades({
  portfolioId,
  page,
  search,
  sort,
}: {
  portfolioId: string;
  page: number;
  search?: string | string[];
  sort?: string | string[];
}) {
  const pageSize = 10;
  const supabase = await supabaseServer();
  const searchStr = Array.isArray(search) ? search[0] : search;
  const { field, order } = parseSort(sort);

  // Base query
  let query = supabase
    .from('trades')
    .select('id, occurred_at, asset_symbol, asset_type, side, quantity, price, fees, currency, platform, notes', { count: 'exact' })
    .eq('portfolio_id', portfolioId);

  // Apply search
  if (searchStr) {
    query = query.ilike('asset_symbol', `%${searchStr}%`);
  }

  // Apply sort
  switch (field) {
    case 'date':
      query = query.order('occurred_at', { ascending: order === 'asc' });
      break;
    case 'asset':
      query = query.order('asset_symbol', { ascending: order === 'asc' });
      break;
    case 'qty':
      query = query.order('quantity', { ascending: order === 'asc' });
      break;
    case 'price':
      query = query.order('price', { ascending: order === 'asc' });
      break;
  }

  // Apply pagination
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query.range(from, to);

  if (error) {
    return (
      <FadeIn className="mt-8 bg-white/50 p-6 border border-zinc-200/50 rounded-2xl backdrop-blur-sm dark:bg-zinc-900/50 dark:border-zinc-800/50">
        <div className="text-sm font-semibold text-zinc-900 dark:text-white">Recent trades</div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Failed to load trades: {error.message}</p>
      </FadeIn>
    );
  }

  const trades = (data ?? []) as TradeRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (trades.length === 0 && !searchStr) {
    return (
      <FadeIn className="mt-8 text-center bg-white/50 p-12 border border-zinc-200/50 rounded-3xl backdrop-blur-sm dark:bg-zinc-900/50 dark:border-zinc-800/50">
        <div className="text-sm font-semibold text-zinc-900 dark:text-white">No trades yet</div>
        <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto dark:text-zinc-400">Your portfolio is empty. Add your first trade to start tracking your performance.</p>
        <Link href="/trades/new" className="mt-4 inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
          Add Trade
        </Link>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.2} className="mt-8 w-full">
      <div className="flex items-end justify-between px-2 py-3 mb-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Recent trades</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {searchStr ? `Searching for "${searchStr}"` : 'Your latest activity (most recent first)'}
          </p>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {total === 0 ? 'No results' : `Page ${safePage} of ${totalPages}`}
        </span>
      </div>

      <div className="rounded-3xl border border-zinc-200/60 bg-white/60 shadow-sm backdrop-blur-xl overflow-hidden dark:border-zinc-800/60 dark:bg-zinc-900/60">
        {/* Mobile-first cards */}
        <div className="grid divide-y divide-zinc-200/50 md:hidden dark:divide-zinc-800/50">
          {trades.map((t) => (
            <div key={t.id} className="p-4 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">{t.asset_symbol}</div>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] uppercase font-bold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    {t.asset_type}
                  </span>
                </div>
                <span className={sideBadgeClass(t.side)}>{t.side}</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-400">
                {platformLabel(t.platform)} · {fmtDate(t.occurred_at)}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Qty</div>
                  <div className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{fmtNumber(t.quantity)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Price</div>
                  <div className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{fmtMoney(t.price, t.currency)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Fees</div>
                  <div className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{fmtMoney(t.fees, t.currency)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Currency</div>
                  <div className="font-medium text-zinc-700 dark:text-zinc-300">{t.currency}</div>
                </div>
              </div>

              {t.notes ? (
                <div className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500 italic dark:border-zinc-800 dark:text-zinc-400">
                  {t.notes}
                </div>
              ) : null}

              <div className="mt-3 flex items-center justify-end gap-4 pt-2">
                <Link
                  href={`/trades/${t.id}/edit`}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Edit
                </Link>
                <DeleteTradeButton
                  tradeId={t.id}
                  portfolioId={portfolioId}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-500 dark:hover:text-rose-400"
                />
              </div>
            </div>
          ))}
          {trades.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No trades found matching "{searchStr}"
            </div>
          )}
        </div>

        {/* md+ table */}
        <div className="hidden md:block">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-max table-auto text-sm">
              <thead className="bg-zinc-50/50 text-xs font-medium text-zinc-500 uppercase tracking-wider dark:bg-zinc-800/30 dark:text-zinc-400">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <SortHeader label="Date" field="date" currentSort={{ field, order }} search={search} />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader label="Asset" field="asset" currentSort={{ field, order }} search={search} />
                  </th>
                  <th className="px-6 py-3 text-left">Platform</th>
                  <th className="px-6 py-3 text-left">Side</th>
                  <th className="px-6 py-3 text-right">
                    <SortHeader label="Qty" field="qty" currentSort={{ field, order }} search={search} />
                  </th>
                  <th className="px-6 py-3 text-right">
                    <SortHeader label="Price" field="price" currentSort={{ field, order }} search={search} />
                  </th>
                  <th className="px-6 py-3 text-right">Fees</th>
                  <th className="px-6 py-3 text-left">Notes</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/50">
                {trades.map((t) => (
                  <tr
                    key={t.id}
                    className="transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                  >
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{fmtDate(t.occurred_at)}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 dark:text-white">{t.asset_symbol}</div>
                      <div className="text-[10px] font-medium uppercase text-zinc-400 tracking-wide dark:text-zinc-400">{t.asset_type}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {platformLabel(t.platform)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={sideBadgeClass(t.side)}>{t.side}</span>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{fmtNumber(t.quantity)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{fmtMoney(t.price, t.currency)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{fmtMoney(t.fees, t.currency)}</td>
                    <td className="px-6 py-4 text-zinc-500 max-w-xs truncate dark:text-zinc-400">
                      {t.notes}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/trades/${t.id}/edit`}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        >
                          Edit
                        </Link>
                        <DeleteTradeButton
                          tradeId={t.id}
                          portfolioId={portfolioId}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-500 dark:hover:text-rose-400"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No trades found matching "{searchStr}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 px-2">
        <Link
          href={{
            pathname: '/trades',
            query: {
              ...(searchStr ? { search: searchStr } : {}),
              ...(sort ? { sort } : {}),
              page: safePage - 1
            }
          }}
          aria-disabled={safePage <= 1}
          className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors ${safePage <= 1
            ? 'border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed pointer-events-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-700'
            : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
        >
          Previous
        </Link>

        <div className="text-xs font-medium text-zinc-500 tabular-nums dark:text-zinc-400">
          {total === 0 ? '0 trades' : `${from + 1}-${Math.min(to + 1, total)} of ${total}`}
        </div>

        <Link
          href={{
            pathname: '/trades',
            query: {
              ...(searchStr ? { search: searchStr } : {}),
              ...(sort ? { sort } : {}),
              page: safePage + 1
            }
          }}
          aria-disabled={safePage >= totalPages}
          className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors ${safePage >= totalPages
            ? 'border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed pointer-events-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-700'
            : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
        >
          Next
        </Link>
      </div>
    </FadeIn>
  );
}