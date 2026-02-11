import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { FadeIn } from '@/components/ui/fade-in';

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

function normalizePlatformsFromTextarea(raw: string): string[] {
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

export default async function SettingsPage() {
  const supabase = await supabaseServer();

  const { data: userSettings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('base_currency, platforms')
    .single();

  // If something else went wrong (not just "no rows"), surface it.
  if (settingsErr && !userSettings) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-red-600">Failed to load settings: {settingsErr.message}</p>
      </div>
    );
  }

  const current = String(userSettings?.base_currency ?? 'USD').toUpperCase();
  const baseCcy = (current === 'INR' ? 'INR' : 'USD') as 'USD' | 'INR';

  const platforms = normalizePlatforms(userSettings?.platforms as string[] | null | undefined);
  const platformsText = platforms.join('\n');

  async function setBaseCurrency(formData: FormData) {
    'use server';
    const next = String(formData.get('baseCurrency') ?? 'USD').toUpperCase();
    const value = (next === 'INR' ? 'INR' : 'USD') as 'USD' | 'INR';

    const supabase = await supabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) redirect('/login');

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: auth.user.id, base_currency: value }, { onConflict: 'user_id' });

    if (error) throw error;

    revalidatePath('/dashboard');
    revalidatePath('/settings');
  }

  async function setPlatforms(formData: FormData) {
    'use server';
    const raw = String(formData.get('platforms') ?? '');
    const list = normalizePlatformsFromTextarea(raw);

    const supabase = await supabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) redirect('/login');

    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: auth.user.id, platforms: list }, { onConflict: 'user_id' });

    if (error) throw error;

    revalidatePath('/dashboard');
    revalidatePath('/trades');
    revalidatePath('/settings');
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <section className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Settings</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Manage your global preferences and integrations.
          </p>
        </section>
      </FadeIn>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Base currency */}
        <FadeIn delay={0.1} className="rounded-3xl border border-zinc-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/60">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">Base currency</div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Default currency for dashboard totals.
          </p>

          <form action={setBaseCurrency} className="mt-4 flex items-center gap-2">
            <div className="relative">
              <select
                name="baseCurrency"
                defaultValue={baseCcy}
                className="h-9 w-[120px] appearance-none rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 text-sm font-medium outline-none focus:border-zinc-900 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white dark:focus:border-white dark:focus:bg-black"
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <button
              type="submit"
              className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </form>

          <p className="mt-3 text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            Current: <span className="font-bold text-zinc-700 dark:text-zinc-300">{baseCcy}</span>
          </p>
        </FadeIn>

        {/* Platforms */}
        <FadeIn delay={0.2} className="rounded-3xl border border-zinc-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/60">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">Trade platforms</div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            One platform per line. Used in dropdowns/filters.
          </p>

          <form action={setPlatforms} className="mt-4 space-y-3">
            <textarea
              name="platforms"
              defaultValue={platformsText}
              rows={5}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm outline-none transition-all focus:border-zinc-900 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white dark:focus:border-white dark:focus:bg-black"
              placeholder={'Manual\nRobinhood\nCoinbase'}
            />
            <button
              type="submit"
              className="h-9 w-full rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              Save platforms
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {platforms.map((p) => (
              <span
                key={p}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              >
                {p}
              </span>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.3} className="rounded-3xl border border-zinc-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl sm:col-span-2 dark:border-zinc-800/60 dark:bg-zinc-900/60">
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">Imports</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Coming soon: import trades from broker apps via CSV or direct integrations.
          </p>
        </FadeIn>
      </div>

      <FadeIn delay={0.4} className="rounded-2xl bg-zinc-50/50 p-4 text-xs text-zinc-500 text-center dark:bg-zinc-900/30 dark:text-zinc-600">
        Preferences are synced to your account.
      </FadeIn>
    </div>
  );
}