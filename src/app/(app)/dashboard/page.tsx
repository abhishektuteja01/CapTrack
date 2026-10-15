import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { getPortfolio } from '@/lib/portfolio';
import { money, moneyDelta, pct, qty, price } from '@/lib/format';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/auth';
import { ensureUserBootstrap } from '@/lib/bootstrap';
import { FadeIn } from '@/components/ui/fade-in';
import { RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  async function refreshDashboard() {
    'use server';
    revalidatePath('/dashboard');
  }

  const user = await getUser();
  if (!user) {
    redirect('/login');
  }
  // First authenticated landing page: ensure default portfolio + settings exist.
  await ensureUserBootstrap(user.id);

  try {

    const sp = searchParams ? await searchParams : undefined;
    const platformFilterRaw = pickFirst(sp?.platform);
    const platformFilter = platformFilterRaw ? String(platformFilterRaw) : undefined;

    const supabase = await supabaseServer();
    const snapshot = await getPortfolio(supabase, { platform: platformFilter, withHistory: false });
    const { baseCurrency, platforms, totals } = snapshot;

    const pnlClass = (n?: number) => {
      if (typeof n !== 'number' || !Number.isFinite(n)) return 'text-zinc-900';
      if (n > 0) return 'text-emerald-600';
      if (n < 0) return 'text-rose-600';
      return 'text-zinc-900';
    };

    const pnlBgClass = (n?: number) => {
      if (typeof n !== 'number' || !Number.isFinite(n)) return 'bg-zinc-100 text-zinc-700';
      if (n > 0) return 'bg-emerald-50 text-emerald-700';
      if (n < 0) return 'bg-rose-50 text-rose-700';
      return 'bg-zinc-100 text-zinc-700';
    };

    const enriched = snapshot.holdings;
    const missing = [...snapshot.missingQuotes, ...snapshot.missingFx];

    return (
      <div className="space-y-6">
        <FadeIn className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
            <p className="text-sm text-zinc-500">
              {enriched.length} assets
            </p>
          </div>

          <form action={refreshDashboard}>
            <button
              type="submit"
              aria-label="Refresh prices"
              title="Refresh prices"
              className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/80 text-zinc-900 shadow-sm transition-all hover:bg-zinc-50 hover:border-zinc-300 hover:scale-105 active:scale-95"
            >
              <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
            </button>
          </form>
        </FadeIn>

        <FadeIn delay={0.1} className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${!platformFilter
              ? 'bg-zinc-900 text-white shadow-md'
              : 'bg-white/80 border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
              }`}
          >
            All
          </Link>
          {platforms.map((p) => (
            <Link
              key={p}
              href={`/dashboard?platform=${encodeURIComponent(p)}`}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${platformFilter === p
                ? 'bg-zinc-900 text-white shadow-md'
                : 'bg-white/80 border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                }`}
            >
              {p}
            </Link>
          ))}
        </FadeIn>

        {missing.length ? (
          <FadeIn delay={0.15} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-800">
            Not included in totals: {missing.join(', ')}. Prices or exchange rates are unavailable right now.
          </FadeIn>
        ) : null}

        {snapshot.fx.rates.length ? (
          <FadeIn delay={0.15} className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 text-xs text-zinc-600">
            Totals are in <span className="font-semibold text-zinc-900">{baseCurrency}</span> using ECB rates from {snapshot.fx.date}:{' '}
            {snapshot.fx.rates.map((r) => `1 ${r.currency} = ${price(r.toBase, baseCurrency)}`).join(', ')}.
          </FadeIn>
        ) : null}

        {/* Summary block */}
        <FadeIn key={`summary-${platformFilter ?? 'all'}`} delay={0.2} className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Invested</div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900">
                {money(totals.costBasis, baseCurrency)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Current Value</div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900">
                {money(totals.value, baseCurrency)}
              </div>
            </div>
          </div>

          <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />

          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-zinc-600">Unrealized P&amp;L</div>
            <div className="flex items-center gap-3">
              <div className={`text-xl font-bold tabular-nums ${pnlClass(totals.unrealized)}`}>
                {moneyDelta(totals.unrealized, baseCurrency)}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${pnlBgClass(totals.unrealized)}`}>
                {pct(totals.unrealizedPct)}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-zinc-600">Today&apos;s P&amp;L</div>
            <div className="flex items-center gap-3">
              <div className={`text-lg font-bold tabular-nums ${pnlClass(totals.dayChange)}`}>
                {moneyDelta(totals.dayChange, baseCurrency)}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${pnlBgClass(totals.dayChange)}`}>
                {pct(totals.dayChangePct)}
              </span>
            </div>
          </div>
        </FadeIn>

        {/* Positions list */}
        <FadeIn key={`positions-${platformFilter ?? 'all'}`} delay={0.3} className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/70 shadow-sm backdrop-blur-xl">
          {enriched.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-500">No positions found.</p>
              <Link href="/trades/new" className="mt-4 inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800">
                Add your first trade
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200/50">
              {enriched.map((p) => {
                return (
                  <li key={p.key} className="p-4 transition-colors hover:bg-zinc-100/50">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left side */}
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
                          {p.type}
                        </div>
                        <div className="mt-0.5 text-lg font-bold tracking-tight text-zinc-900">
                          {p.symbol}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          <span>{qty(p.quantity)} units</span>
                          <span className="h-1 w-1 rounded-full bg-zinc-300"></span>
                          <span>Avg {price(p.avgCost, p.tradeCurrency ?? baseCurrency)}</span>
                        </div>
                      </div>

                      {/* Right side */}
                      <div className="shrink-0 text-right">
                        <div className={`text-xs font-bold tabular-nums ${pnlClass(p.unrealizedBase)}`}>
                          {pct(p.unrealizedPct)}
                        </div>
                        <div className={`mt-0.5 text-lg font-bold tabular-nums ${pnlClass(p.unrealizedBase)}`}>
                          {moneyDelta(p.unrealizedBase, baseCurrency)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400 tabular-nums">
                          LTP {price(p.price, p.quoteCurrency ?? baseCurrency)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </FadeIn>

        {/* Sticky day P&L bar (mobile) */}
        {enriched.length > 0 ? (
          <FadeIn delay={0.5} className="fixed left-0 right-0 bottom-24 z-40 px-4 sm:hidden pointer-events-none">
            <div className="rounded-2xl border border-zinc-200/80 bg-white/90 backdrop-blur-xl px-4 py-3 shadow-lg pointer-events-auto">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Today</div>
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-bold tabular-nums ${pnlClass(totals.dayChange)}`}>
                    {moneyDelta(totals.dayChange, baseCurrency)}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${pnlBgClass(totals.dayChange)}`}>
                    {pct(totals.dayChangePct)}
                  </span>
                </div>
              </div>
            </div>
          </FadeIn>
        ) : null}

      </div>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <div className="rounded-xl border border-zinc-200 p-4">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">Something went wrong loading your dashboard.</p>
        <p className="mt-2 text-xs text-zinc-500 font-mono break-all">{message}</p>
      </div>
    );
  }
}
