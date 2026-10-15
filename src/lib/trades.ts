// src/lib/trades.ts
// Loading trades for the trades log and the trade form. Server only.

import type { SupabaseClient } from '@supabase/supabase-js';

/** What the trade form needs to edit an existing trade. */
export type EditableTrade = {
  id: string;
  occurredAt: string; // ISO
  symbol: string;
  assetName: string | null;
  assetType: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  platform: string;
  notes: string | null;
  fxRate: number | null;
  fxQuote: string | null;
};

export type TradeListRow = EditableTrade;

const COLUMNS = '*';

type Row = {
  id: string;
  occurred_at: string;
  asset_symbol: string;
  asset_name: string | null;
  asset_type: string;
  side: 'BUY' | 'SELL';
  quantity: number | string;
  price: number | string;
  fees: number | string | null;
  currency: string;
  platform: string | null;
  notes: string | null;
  fx_rate?: number | string | null;
  fx_quote?: string | null;
};

function toEditable(r: Row): EditableTrade {
  return {
    id: String(r.id),
    occurredAt: r.occurred_at,
    symbol: r.asset_symbol,
    assetName: r.asset_name ?? null,
    assetType: r.asset_type,
    side: r.side,
    quantity: Number(r.quantity),
    price: Number(r.price),
    fees: Number(r.fees ?? 0),
    currency: (r.currency ?? '').toUpperCase(),
    platform: r.platform?.trim() || 'Manual',
    notes: r.notes ?? null,
    fxRate: r.fx_rate == null ? null : Number(r.fx_rate),
    fxQuote: r.fx_quote ?? null,
  };
}

export async function loadTrade(supabase: SupabaseClient, id: string): Promise<EditableTrade | null> {
  const { data, error } = await supabase.from('trades').select(COLUMNS).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toEditable(data as Row);
}

export type TradeQuery = {
  page: number;
  pageSize: number;
  symbol?: string;
  platform?: string;
  side?: 'BUY' | 'SELL';
};

/** One page of trades, newest first, plus the total count for pagination. */
export async function listTrades(
  supabase: SupabaseClient,
  q: TradeQuery
): Promise<{ rows: TradeListRow[]; total: number }> {
  let query = supabase.from('trades').select(COLUMNS, { count: 'exact' });
  if (q.symbol) query = query.ilike('asset_symbol', `%${q.symbol.replace(/[%_]/g, '')}%`);
  if (q.platform) query = query.eq('platform', q.platform);
  if (q.side) query = query.eq('side', q.side);
  const from = (q.page - 1) * q.pageSize;
  const { data, count, error } = await query
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + q.pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: ((data ?? []) as Row[]).map(toEditable), total: count ?? 0 };
}
