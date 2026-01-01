import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

function normalizePlatforms(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // de-dupe (case-insensitive) while preserving order
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
  const cookieStore = await cookies();

  // Base currency
  const current = (cookieStore.get('captrack_base_ccy')?.value ?? 'USD').toUpperCase();
  const baseCcy = (current === 'INR' ? 'INR' : 'USD') as 'USD' | 'INR';

  // Platforms
  const platformsCookie = cookieStore.get('captrack_platforms')?.value;
  const platforms = normalizePlatforms((platformsCookie ?? 'Manual').replaceAll('%0A', '\n'));
  const platformsText = platforms.join('\n');

  async function setBaseCurrency(formData: FormData) {
    'use server';
    const next = String(formData.get('baseCurrency') ?? 'USD').toUpperCase();
    const value = (next === 'INR' ? 'INR' : 'USD') as 'USD' | 'INR';

    const store = await cookies();
    store.set('captrack_base_ccy', value, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });

    revalidatePath('/dashboard');
    revalidatePath('/settings');
  }

  async function setPlatforms(formData: FormData) {
    'use server';
    const raw = String(formData.get('platforms') ?? '');
    const list = normalizePlatforms(raw);

    const store = await cookies();
    store.set('captrack_platforms', list.join('\n'), {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });

    revalidatePath('/dashboard');
    revalidatePath('/trades');
    revalidatePath('/settings');
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-600">
          Preferences and integrations will live here. For now, CapTrack focuses on clean trade entry and correctness.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {/* Base currency */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="text-sm font-medium">Base currency</div>
          <p className="mt-1 text-sm text-zinc-600">
            Dashboard totals will be converted into your selected base currency.
          </p>

          <form action={setBaseCurrency} className="mt-3 flex items-center gap-2">
            <select
              name="baseCurrency"
              defaultValue={baseCcy}
              className="h-10 w-full max-w-[180px] rounded-md border-2 border-zinc-300 bg-white px-3 text-sm focus:border-zinc-900 focus:outline-none"
            >
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-md border-2 border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Save
            </button>
          </form>

          <p className="mt-2 text-xs text-zinc-500">
            Current: <span className="font-semibold text-zinc-900">{baseCcy}</span>
          </p>
        </div>

        {/* Platforms */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="text-sm font-medium">Trade platforms</div>
          <p className="mt-1 text-sm text-zinc-600">
            Add the platforms you use (one per line). This list will show as a dropdown in Add Trade and as a filter on the dashboard.
          </p>

          <form action={setPlatforms} className="mt-3 space-y-2">
            <textarea
              name="platforms"
              defaultValue={platformsText}
              rows={6}
              className="w-full rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
              placeholder="Manual\nRobinhood\nCoinbase\nZerodha"
            />
            <button
              type="submit"
              className="h-10 rounded-md border-2 border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Save platforms
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {platforms.map((p) => (
              <span
                key={p}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700"
              >
                {p}
              </span>
            ))}
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            Tip: keep names short (e.g., “Zerodha”, “Coinbase”).
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 sm:col-span-2">
          <div className="text-sm font-medium">Imports</div>
          <p className="mt-1 text-sm text-zinc-600">
            Coming soon: import trades from broker apps via CSV or direct integrations.
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
        <div className="font-medium text-zinc-900">Prototype note</div>
        <p className="mt-1">
          Platforms are stored locally (cookie) for now. Later we’ll persist per-user settings in Supabase.
        </p>
      </section>
    </div>
  );
}