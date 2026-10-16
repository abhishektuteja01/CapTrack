// src/lib/repo/tradesRepo.ts
// Writes for trades and cash entries. Every query also filters by user_id (defense in depth with RLS).

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

  fx_rate?: number | null;
  fx_quote?: string | null;

  external_id?: string | null;
  underlying?: string | null;
  expiry?: string | null;
  strike?: number | null;
  option_type?: string | null;
  lot_size?: number | null;
};

export type CashUpsertPayload = {
  occurred_at: string;
  kind: string;
  amount: number;
  currency: string;
  platform: string;
  asset_symbol: string | null;
  asset_type: string | null;
  notes: string | null;
  external_id?: string | null;
};

type Result = { ok: true } | { ok: false; message: string };

type Table = 'trades' | 'cash_entries';

async function upsert(table: Table, id: string | null | undefined, userId: string, payload: object): Promise<Result> {
  const supabase = await supabaseServer();
  const row = { ...payload, user_id: userId };
  const { error } = id
    ? await supabase.from(table).update(row).eq('id', id).eq('user_id', userId)
    : await supabase.from(table).insert(row);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function upsertTrade(args: { tradeId?: string | null; userId: string; payload: TradesUpsertPayload }) {
  return upsert('trades', args.tradeId, args.userId, args.payload);
}

export function upsertCash(args: { id?: string | null; userId: string; payload: CashUpsertPayload }) {
  return upsert('cash_entries', args.id, args.userId, args.payload);
}

/** Delete rows by id from one table. */
export async function deleteRows(table: Table, ids: string[], userId: string): Promise<Result> {
  if (!ids.length) return { ok: true };
  const supabase = await supabaseServer();
  const { error } = await supabase.from(table).delete().in('id', ids).eq('user_id', userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function deleteTrade(args: { tradeId: string; userId: string }) {
  return deleteRows('trades', [args.tradeId], args.userId);
}

/** Insert many rows in batches. Stops at the first failing batch. */
export async function insertMany(table: Table, userId: string, rows: object[]): Promise<{ inserted: number; error?: string }> {
  const supabase = await supabaseServer();
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map((r) => ({ ...r, user_id: userId }));
    const { error } = await supabase.from(table).insert(batch);
    if (error) return { inserted, error: error.message };
    inserted += batch.length;
  }
  return { inserted };
}
