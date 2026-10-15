// src/app/trades/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { tradeSchema } from '@/lib/validators/trade';
import { deleteTrade, upsertTrade } from '@/lib/repo/tradesRepo';
import { getUser } from '@/lib/supabase/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { normalizePlatforms } from '@/lib/settings';

export type TradeActionState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function toNumber(value: FormDataEntryValue | null): number | undefined {
  if (value == null || value.toString().trim() === '') return undefined;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : undefined;
}

function toStringVal(value: FormDataEntryValue | null): string | undefined {
  if (value == null) return undefined;
  const s = value.toString().trim();
  return s.length ? s : undefined;
}

/** Only same-site paths, so a crafted form can't redirect elsewhere. */
function safeReturn(value: FormDataEntryValue | null, fallback: string) {
  const s = toStringVal(value);
  return s && s.startsWith('/') && !s.startsWith('//') ? s : fallback;
}

function revalidateAll() {
  revalidatePath('/trades');
  revalidatePath('/dashboard');
  revalidatePath('/holdings');
}

/**
 * Create or update a trade. Validates with Zod, adds a new platform to settings,
 * then returns the user to `returnTo`.
 */
export async function saveTradeAction(
  _prevState: TradeActionState | undefined,
  formData: FormData
): Promise<TradeActionState> {
  const user = await getUser();
  if (!user) return { ok: false, message: 'Your session ended. Sign in again to save this trade.' };

  const tradeId = toStringVal(formData.get('tradeId'));
  const fxOverride = formData.get('fxOverride') === 'on';

  const raw = {
    // The browser sends the user's local date and time already converted to an ISO timestamp.
    occurredAt: toStringVal(formData.get('occurredAt')),
    asset: {
      symbol: toStringVal(formData.get('symbol')),
      type: toStringVal(formData.get('assetType')),
      name: toStringVal(formData.get('assetName')),
    },
    side: toStringVal(formData.get('side')),
    quantity: toNumber(formData.get('quantity')),
    price: toNumber(formData.get('price')),
    fees: toNumber(formData.get('fees')) ?? 0,
    currency: toStringVal(formData.get('currency')),
    fxRate: fxOverride ? toNumber(formData.get('fxRate')) : undefined,
    fxQuote: fxOverride ? toStringVal(formData.get('fxQuote')) : undefined,
    platform: toStringVal(formData.get('platform')) ?? 'Manual',
    source: 'manual',
    notes: toStringVal(formData.get('notes')),
  };

  const parsed = tradeSchema.safeParse(raw);
  const missingRate = fxOverride && raw.fxRate === undefined;
  if (!parsed.success || missingRate) {
    const flat = (parsed.success ? {} : parsed.error.flatten().fieldErrors) as Record<string, string[]>;
    if (missingRate) flat.fxRate = ['Enter the rate your broker used'];
    return { ok: false, message: 'Check the highlighted fields.', fieldErrors: flat };
  }

  const trade = parsed.data;
  const res = await upsertTrade({
    tradeId,
    userId: user.id,
    payload: {
      occurred_at: trade.occurredAt,
      asset_symbol: trade.asset.symbol,
      asset_type: trade.asset.type,
      asset_name: trade.asset.name ?? null,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      fees: trade.fees,
      currency: trade.currency,
      platform: trade.platform ?? 'Manual',
      source: trade.source,
      notes: trade.notes ?? null,
      // Always written on edit so clearing the override sticks.
      fx_rate: trade.fxRate ?? null,
      fx_quote: trade.fxRate ? (trade.fxQuote ?? null) : null,
    },
  });

  if (!res.ok) {
    console.error('[trades] save failed', res.message);
    return { ok: false, message: "The trade wasn't saved because the database didn't accept it. Try again in a moment." };
  }

  // A platform typed in the form joins the user's list.
  const supabase = await supabaseServer();
  const { data: settings } = await supabase.from('user_settings').select('platforms').maybeSingle();
  const current = normalizePlatforms(settings?.platforms as string[] | null);
  if (!current.some((p) => p.toLowerCase() === trade.platform.toLowerCase())) {
    await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, platforms: normalizePlatforms([...current, trade.platform]) }, { onConflict: 'user_id' });
    revalidatePath('/settings');
  }

  revalidateAll();
  redirect(safeReturn(formData.get('returnTo'), '/trades'));
}

export async function deleteTradeAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) redirect('/login');

  const tradeId = toStringVal(formData.get('tradeId'));
  if (tradeId) {
    const res = await deleteTrade({ tradeId, userId: user.id });
    if (!res.ok) console.error('[trades] delete failed', res.message);
  }

  revalidateAll();
  redirect(safeReturn(formData.get('returnTo'), '/trades'));
}
