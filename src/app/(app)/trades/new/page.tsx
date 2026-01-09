import Link from 'next/link';

import TradeForm from '@/components/trades/trade-form';
import { supabaseServer } from '@/lib/supabase/server';

function normalizePlatforms(raw: string[] | null | undefined): string[] {
  const items = (raw ?? []).map((s) => String(s).trim()).filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of items) {
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

  const { data: portfolios, error: portfoliosError } = await supabase
    .from('portfolios')
    .select('id, name, created_at')
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
        <p className="text-sm text-zinc-600">No portfolio found.</p>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md border-2 border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  const { data: userSettings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('platforms')
    .single();

  if (settingsErr) {
    // If something goes wrong, fall back to a safe default.
    // Bootstrapping in layout should make this rare.
    console.warn('Failed to load user settings:', settingsErr.message);
  }

  const platforms = normalizePlatforms(userSettings?.platforms as string[] | null | undefined);

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