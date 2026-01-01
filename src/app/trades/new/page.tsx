

import Link from 'next/link';
import { cookies } from 'next/headers';

import TradeForm from '../trade-form';
import { supabaseServer } from '@/lib/db/supabase/server';

function normalizePlatforms(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of lines) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }

  return out.length ? out : ['Manual'];
}

export default async function NewTradePage() {
  const supabase = await supabaseServer();

  // Use your first (default) portfolio for now.
  const { data: portfolios, error: portfoliosError } = await supabase
    .from('portfolios')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1);

  if (portfoliosError) {
    throw new Error(portfoliosError.message);
  }

  const portfolio = portfolios?.[0];
  if (!portfolio) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Add trade</h1>
        <p className="text-sm text-zinc-600">No portfolio found. Create one first.</p>
        <Link
          href="/trades"
          className="inline-flex h-10 items-center justify-center rounded-md border-2 border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Back to trades
        </Link>
      </div>
    );
  }

  const cookieStore = await cookies();
  const platformsCookie = cookieStore.get('captrack_platforms')?.value;
  const platforms = normalizePlatforms((platformsCookie ?? 'Manual').replaceAll('%0A', '\n'));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add trade</h1>
          <p className="mt-1 text-sm text-zinc-600">Adding trades into: <span className="font-semibold text-zinc-900">{portfolio.name}</span></p>
        </div>

        <Link
          href="/trades"
          className="inline-flex h-10 items-center justify-center rounded-md border-2 border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Trade details</h2>
          <p className="text-xs text-zinc-500">All fields saved to Supabase</p>
        </div>
        <TradeForm portfolioId={portfolio.id} platforms={platforms} />
      </section>

      <p className="text-xs text-zinc-500">
        Tip: set Platforms in <Link href="/settings" className="underline">Settings</Link>.
      </p>
    </div>
  );
}