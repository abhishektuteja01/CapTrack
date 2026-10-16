'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getUser } from '@/lib/supabase/auth';
import { currencySchema, normalizePlatforms, platformsSchema } from '@/lib/settings';

export type SettingsState = { ok: boolean; message: string } | undefined;

async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return { supabase: await supabaseServer(), user };
}

function revalidateAll() {
  revalidatePath('/', 'layout');
}

export async function saveBaseCurrencyAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = currencySchema.safeParse(formData.get('baseCurrency'));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Pick a currency' };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, base_currency: parsed.data }, { onConflict: 'user_id' });
  if (error) return { ok: false, message: "Couldn't save. Try again in a moment." };
  revalidateAll();
  return { ok: true, message: `Totals now show in ${parsed.data}.` };
}

const renamesSchema = z.array(z.object({ from: z.string().min(1), to: z.string().min(1).max(64) })).max(50);

/** Save the platform list. Renamed platforms are renamed on existing trades too. */
export async function savePlatformsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  let list: unknown;
  let renames: unknown;
  try {
    list = JSON.parse(String(formData.get('platforms') ?? '[]'));
    renames = JSON.parse(String(formData.get('renames') ?? '[]'));
  } catch {
    return { ok: false, message: 'Something went wrong reading the list. Reload and try again.' };
  }
  const p = platformsSchema.safeParse(list);
  const r = renamesSchema.safeParse(renames);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Check the platform names' };
  if (!r.success) return { ok: false, message: 'Something went wrong reading the renames. Reload and try again.' };

  const { supabase, user } = await requireUser();
  for (const { from, to } of r.data) {
    if (from.trim() === to.trim()) continue;
    const [t, c] = await Promise.all([
      supabase.from('trades').update({ platform: to.trim() }).eq('platform', from).eq('user_id', user.id),
      supabase.from('cash_entries').update({ platform: to.trim() }).eq('platform', from).eq('user_id', user.id),
    ]);
    if (t.error || c.error) return { ok: false, message: `Couldn't rename ${from}. Nothing else was changed after it.` };
  }
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, platforms: p.data }, { onConflict: 'user_id' });
  if (error) return { ok: false, message: "Couldn't save. Try again in a moment." };
  revalidateAll();
  return { ok: true, message: 'Platforms saved.' };
}

export async function saveNameAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name || name.length > 80) return { ok: false, message: 'Enter a name up to 80 characters.' };
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ data: { display_name: name } });
  if (error) return { ok: false, message: "Couldn't save. Try again in a moment." };
  // The name is read from the session token, so issue a fresh one that carries it.
  await supabase.auth.refreshSession();
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Name saved.' };
}

/** First-run setup from the empty Overview: base currency and platforms, then the trade form. */
export async function saveSetupAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const c = currencySchema.safeParse(formData.get('baseCurrency'));
  if (!c.success) return { ok: false, message: c.error.issues[0]?.message ?? 'Pick a currency' };
  let list: unknown;
  try {
    list = JSON.parse(String(formData.get('platforms') ?? '[]'));
  } catch {
    list = [];
  }
  const p = platformsSchema.safeParse(list);
  const platforms = p.success ? p.data : normalizePlatforms([]);
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, base_currency: c.data, platforms }, { onConflict: 'user_id' });
  if (error) return { ok: false, message: "Couldn't save. Try again in a moment." };
  revalidateAll();
  redirect('/trades?trade=new');
}

const returnsSchema = z.object({
  costMethod: z.enum(['fifo', 'average']),
  fyStartMonth: z.coerce.number().int().min(1).max(12),
  longTermMonths: z.coerce.number().int().min(1, 'At least 1 month').max(60, 'Up to 60 months'),
  benchmark: z
    .string()
    .trim()
    .max(24)
    .transform((s) => s.toUpperCase())
    .refine((s) => s === '' || /^[\^A-Z0-9.=&-]+$/.test(s), 'Use a Yahoo symbol like ^NSEI'),
});

/** Cost method, tax year, long-term threshold and benchmark. */
export async function saveReturnsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = returnsSchema.safeParse({
    costMethod: formData.get('costMethod'),
    fyStartMonth: formData.get('fyStartMonth'),
    longTermMonths: formData.get('longTermMonths'),
    benchmark: formData.get('benchmark') === '__custom__' ? formData.get('customBenchmark') ?? '' : formData.get('benchmark') ?? '',
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the values' };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: user.id,
      cost_method: parsed.data.costMethod,
      fy_start_month: parsed.data.fyStartMonth,
      long_term_months: parsed.data.longTermMonths,
      benchmark: parsed.data.benchmark || null,
    },
    { onConflict: 'user_id' }
  );
  if (error) return { ok: false, message: "Couldn't save. Try again in a moment." };
  revalidateAll();
  return { ok: true, message: 'Saved. Every page now uses these.' };
}

/** Remove every trade and cash entry (for starting over or re-importing). Settings stay. */
export async function deleteAllAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  if (String(formData.get('confirm') ?? '').trim().toLowerCase() !== 'delete') {
    return { ok: false, message: 'Type delete to confirm.' };
  }
  const { supabase, user } = await requireUser();
  const [t, c] = await Promise.all([
    supabase.from('trades').delete().eq('user_id', user.id),
    supabase.from('cash_entries').delete().eq('user_id', user.id),
  ]);
  if (t.error || c.error) return { ok: false, message: "Couldn't delete everything. Try again in a moment." };
  revalidateAll();
  return { ok: true, message: 'All trades and cash entries deleted.' };
}
