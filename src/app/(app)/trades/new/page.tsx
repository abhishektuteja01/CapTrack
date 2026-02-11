import Link from 'next/link';
import { FadeIn } from '@/components/ui/fade-in';

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
    <div className="max-w-2xl mx-auto space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Add Trade</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Adding to <span className="font-semibold text-zinc-900 dark:text-zinc-200">{portfolio.name}</span>
            </p>
          </div>

          <Link
            href="/trades"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:text-white"
          >
            Cancel
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.1} className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/60">
        <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Transaction Details</h2>
          <div className="text-[10px] uppercase tracking-wider font-medium text-zinc-400 dark:text-zinc-500">
            Secure Entry
          </div>
        </div>

        <TradeForm portfolioId={portfolio.id} platforms={platforms} />
      </FadeIn>

      <FadeIn delay={0.2} className="text-center">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Tip: You can manage your trading platforms in <Link href="/settings" className="underline hover:text-zinc-900 dark:hover:text-zinc-300">Settings</Link>.
        </p>
      </FadeIn>
    </div>
  );
}