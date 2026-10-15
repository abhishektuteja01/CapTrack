'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { currencySchema, normalizePlatforms, platformsSchema } from '@/lib/settings';

export type SettingsState = { ok: boolean; message: string } | undefined;

async function requireUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  return { supabase, user: data.user };
}

function revalidateAll() {
  revalidatePath('/dashboard');
  revalidatePath('/holdings');
  revalidatePath('/trades');
  revalidatePath('/settings');
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
    const { error } = await supabase.from('trades').update({ platform: to.trim() }).eq('platform', from).eq('user_id', user.id);
    if (error) return { ok: false, message: `Couldn't rename ${from}. Nothing else was changed after it.` };
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
  redirect('/trades?new=1');
}
