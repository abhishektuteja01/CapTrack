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
  portfolioId: string;
  payload: TradesUpsertPayload;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { tradeId, portfolioId, payload } = args;
  const supabase = await supabaseServer();

  const row = { ...payload, portfolio_id: portfolioId };

  const { error } = tradeId
    ? await supabase
        .from('trades')
        .update(row)
        .eq('id', tradeId)
        .eq('portfolio_id', portfolioId)
    : await supabase.from('trades').insert(row);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteTrade(args: {
  tradeId: string;
  portfolioId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { tradeId, portfolioId } = args;
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('portfolio_id', portfolioId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
