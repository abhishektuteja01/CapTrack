// src/lib/repo/tradesRepo.ts

import { supabaseServer } from '@/lib/supabase/server';

export type TradesUpsertPayload = {
  occurred_at: string;

  asset_symbol: string;
  asset_type: string;
  asset_name: string | null;

  side: 'BUY' | 'SELL';

  quantity: number;
  price: number;
  fees: number;

  currency: string;
  platform: string;

  source: string;
  notes: string | null;
};

export async function upsertTrade(args: {
  tradeId?: string | null;
  userId: string;
  payload: TradesUpsertPayload;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { tradeId, userId, payload } = args;
  const supabase = await supabaseServer();

  const row = { ...payload, user_id: userId };

  const { error } = tradeId
    ? await supabase
        .from('trades')
        .update(row)
        .eq('id', tradeId)
        .eq('user_id', userId)
    : await supabase.from('trades').insert(row);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteTrade(args: {
  tradeId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { tradeId, userId } = args;
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('user_id', userId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
