// src/lib/trades.ts
// Loading trades and cash entries for the activity log and the entry forms. Server only.

import type { SupabaseClient } from '@supabase/supabase-js';
import { replay, type Contract, type CostMethod, type TradeLike } from '@/lib/domain/portfolio/positions';
import type { Split } from '@/lib/domain/portfolio/splits';
import type { CashKind } from '@/lib/domain/portfolio/money';
import { toContract, type AppTrade, type CashRow, type TradeRow } from '@/lib/portfolio';

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
  contract: Contract | null;
};

export type EditableCash = {
  id: string;
  occurredAt: string;
  kind: CashKind;
  amount: number;
  currency: string;
  platform: string;
  assetSymbol: string | null;
  assetType: string | null;
  notes: string | null;
};

/** An open position on one platform, for the sell helper in the trade form. */
export type OpenAccount = {
  symbol: string;
  type: string;
  name?: string;
  platform: string;
  currency?: string;
  /** Signed: negative for a short F&O position. */
  quantity: number;
  avgCost: number;
  contract?: Contract;
  /** Oldest first: what FIFO sells next. */
  lots: { openedAt: string; qty: number; unitCost: number }[];
};

/** Open positions per platform from the trade log (no prices needed). */
export function openAccounts(trades: AppTrade[], method: CostMethod, splits?: Map<string, Split[]>): OpenAccount[] {
  const names = new Map(trades.map((t) => [`${t.asset.type}|${t.asset.symbol}`, t.name]));
  return replay(trades as TradeLike[], { method, splits })
    .positions.filter((p) => !p.closed && !p.unsettled)
    .map((p) => ({
      symbol: p.asset.symbol,
      type: String(p.asset.type),
      name: names.get(`${p.asset.type}|${p.asset.symbol}`),
      platform: p.platform,
      currency: p.currency,
      quantity: p.quantity,
      avgCost: p.avgCost,
      contract: p.contract,
      lots: p.lots.map((l) => ({ openedAt: l.openedAt, qty: Math.abs(l.qty), unitCost: l.unitCost })),
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol) || a.platform.localeCompare(b.platform));
}

/** One line in the activity log: a trade or a cash entry. */
export type ActivityRow = {
  id: string;
  entry: 'trade' | 'cash';
  kind: 'BUY' | 'SELL' | CashKind;
  occurredAt: string;
  symbol: string | null;
  assetType: string | null;
  assetName: string | null;
  quantity: number | null;
  price: number | null;
  fees: number | null;
  amount: number;
  currency: string;
  platform: string;
  notes: string | null;
};

export function toEditableTrade(r: TradeRow): EditableTrade {
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
    currency: (r.currency ?? '').trim().toUpperCase(),
    platform: r.platform?.trim() || 'Manual',
    notes: r.notes ?? null,
    fxRate: r.fx_rate == null ? null : Number(r.fx_rate),
    fxQuote: r.fx_quote ?? null,
    contract: toContract(r),
  };
}

export async function loadTrade(supabase: SupabaseClient, id: string): Promise<EditableTrade | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from('trades').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toEditableTrade(data as TradeRow);
}

export async function loadCash(supabase: SupabaseClient, id: string): Promise<EditableCash | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from('cash_entries').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const r = data as CashRow;
  return {
    id: r.id,
    occurredAt: r.occurred_at,
    kind: r.kind,
    amount: Number(r.amount),
    currency: r.currency,
    platform: r.platform?.trim() || 'Manual',
    assetSymbol: r.asset_symbol,
    assetType: r.asset_type,
    notes: r.notes,
  };
}

export type ActivityQuery = {
  page: number;
  pageSize: number;
  symbol?: string;
  platform?: string;
  kind?: string;
};

/** One page of trades and cash entries, newest first, plus the total count for pagination. */
export async function listActivity(
  supabase: SupabaseClient,
  q: ActivityQuery
): Promise<{ rows: ActivityRow[]; total: number }> {
  let query = supabase.from('activity').select('*', { count: 'exact' });
  if (q.symbol) query = query.ilike('asset_symbol', `%${q.symbol.replace(/[%_]/g, '')}%`);
  if (q.platform) query = query.eq('platform', q.platform);
  if (q.kind) query = query.eq('kind', q.kind);
  const from = (q.page - 1) * q.pageSize;
  const { data, count, error } = await query
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + q.pageSize - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    rows: rows.map((r) => ({
      id: String(r.id),
      entry: r.entry as 'trade' | 'cash',
      kind: r.kind as ActivityRow['kind'],
      occurredAt: String(r.occurred_at),
      symbol: (r.asset_symbol as string | null) ?? null,
      assetType: (r.asset_type as string | null) ?? null,
      assetName: (r.asset_name as string | null) ?? null,
      quantity: num(r.quantity),
      price: num(r.price),
      fees: num(r.fees),
      amount: Number(r.amount),
      currency: String(r.currency).trim(),
      platform: (r.platform as string | null)?.trim() || 'Manual',
      notes: (r.notes as string | null) ?? null,
    })),
    total: count ?? 0,
  };
}
