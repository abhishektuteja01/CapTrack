// src/app/trades/page.tsx
import { supabaseServer } from '@/lib/supabase/server';
import RecentTrades from '@/components/trades/recent-trades';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/auth';
import Link from 'next/link';
import { FadeIn } from '@/components/ui/fade-in';
import TradeFilters from '@/components/trades/trade-filters';

export default async function TradesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }
  const supabase = await supabaseServer();

  const sp = searchParams ? await searchParams : undefined;
  const pageParam = sp?.page;
  const pageStr = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const page = Math.max(1, Number.parseInt(pageStr ?? '1', 10) || 1);

  // For v1 we just grab the first portfolio.
  // Later: allow selecting portfolios, per-user portfolios, etc.
  const { data: portfolios, error } = await supabase
    .from('portfolios')
    .select('id, name, created_at')
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
        <p>No portfolio found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Trades</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Adding trades into: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{portfolio.name}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            <TradeFilters />

            <Link
              href="/trades/new"
              className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-all hover:bg-zinc-800 hover:scale-105 active:scale-95 whitespace-nowrap dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Add trade
            </Link>
          </div>
        </div>

        <div className="mt-6">
          {/* Placeholder for now to ensure imports work */}
        </div>
      </FadeIn>

      <RecentTrades
        portfolioId={portfolio.id}
        page={page}
        search={sp?.search}
        sort={sp?.sort}
      />
    </div>
  );
}