import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FadeIn } from '@/components/ui/fade-in';

import TradeForm from '@/components/trades/trade-form';
import { supabaseServer } from '@/lib/supabase/server';
import { getUser } from '@/lib/supabase/auth';

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
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = await supabaseServer();

  const { data: userSettings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('platforms')
    .single();

  if (settingsErr) {
    console.warn('Failed to load user settings:', settingsErr.message);
  }

  const platforms = normalizePlatforms(userSettings?.platforms as string[] | null | undefined);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Add Trade</h1>
            <p className="text-sm text-zinc-600">Add a new transaction</p>
          </div>

          <Link
            href="/trades"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.1} className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Transaction Details</h2>
          <div className="text-[10px] uppercase tracking-wider font-medium text-zinc-400">
            Secure Entry
          </div>
        </div>

        <TradeForm platforms={platforms} />
      </FadeIn>

      <FadeIn delay={0.2} className="text-center">
        <p className="text-xs text-zinc-400">
          Tip: You can manage your trading platforms in <Link href="/settings" className="underline hover:text-zinc-900">Settings</Link>.
        </p>
      </FadeIn>
    </div>
  );
}