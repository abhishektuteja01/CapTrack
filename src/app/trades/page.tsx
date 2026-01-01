// src/app/trades/page.tsx
import { supabaseServer } from '@/lib/db/supabase/server';
import RecentTrades from './recent-trades';

export default async function TradesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseServer();

  const sp = searchParams ? await searchParams : undefined;
  const pageParam = sp?.page;
  const pageStr = Array.isArray(pageParam) ? pageParam[0] : pageParam;
  const page = Math.max(1, Number.parseInt(pageStr ?? '1', 10) || 1);

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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 space-y-6">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trades</h1>
            <p className="text-sm text-zinc-600">
              Adding trades into: <span className="font-medium text-zinc-900">{portfolio.name}</span>
            </p>
          </div>

          <a
            href="/trades/new"
            className="inline-flex h-10 items-center justify-center rounded-md border-2 border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Add trade
          </a>
        </div>
      </header>

      <RecentTrades portfolioId={portfolio.id} page={page} />
    </div>
  );
}