// src/app/trades/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { tradeSchema } from '@/lib/validators/trade';
import { deleteTrade, upsertTrade } from '@/lib/repo/tradesRepo';

type ActionState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function toNumber(value: FormDataEntryValue | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : undefined;
}

function toStringVal(value: FormDataEntryValue | null): string | undefined {
  if (value == null) return undefined;
  const s = value.toString().trim();
  return s.length ? s : undefined;
}

/**
 * Creates a trade after validating input with Zod.
 * NOTE: This validates structure/ranges. Portfolio-level constraints (e.g. cannot sell more than owned)
 * come later when we implement position logic.
 */
export async function createTradeAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const portfolioId = toStringVal(formData.get('portfolioId'));
  const occurredAtLocal = toStringVal(formData.get('occurredAt')); // datetime-local
  const occurredAtIso = occurredAtLocal ? new Date(occurredAtLocal).toISOString() : undefined;
  const tradeId = toStringVal(formData.get('tradeId'));

  const raw = {
    portfolioId,
    occurredAt: occurredAtIso,

    asset: {
      symbol: toStringVal(formData.get('symbol')),
      type: toStringVal(formData.get('assetType')),
      name: toStringVal(formData.get('assetName')),
    },

    side: toStringVal(formData.get('side')),

    quantity: toNumber(formData.get('quantity')),
    price: toNumber(formData.get('price')),
    fees: toNumber(formData.get('fees')) ?? 0,

    currency: toStringVal(formData.get('currency')) ?? 'USD',

    platform: toStringVal(formData.get('platform')) ?? 'Manual',

    source: 'manual',
    notes: toStringVal(formData.get('notes')),
  };

  const parsed = tradeSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors };
  }

  const trade = parsed.data;

  const payload = {
    portfolio_id: trade.portfolioId,
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
  };

  const res = await upsertTrade({
    tradeId,
    portfolioId: trade.portfolioId,
    payload,
  });

  if (!res.ok) {
    return { ok: false, message: `DB error: ${res.message}` };
  }

  revalidatePath('/trades');
  revalidatePath('/dashboard');
  redirect('/trades');
}

export async function deleteTradeAction(formData: FormData): Promise<void> {
  const tradeId = toStringVal(formData.get('tradeId'));
  const portfolioId = toStringVal(formData.get('portfolioId'));

  if (!tradeId || !portfolioId) return;

  await deleteTrade({ tradeId, portfolioId });

  revalidatePath('/trades');
  revalidatePath('/dashboard');
}