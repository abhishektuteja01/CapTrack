// src/app/(app)/trades/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { cashSchema, tradeSchema, type CashInput, type TradeInput } from '@/lib/validators/trade';
import { deleteRows, insertMany, upsertCash, upsertTrade, type CashUpsertPayload, type TradesUpsertPayload } from '@/lib/repo/tradesRepo';
import { getUser } from '@/lib/supabase/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { normalizePlatforms } from '@/lib/settings';
import { loadLedger, type AppTrade } from '@/lib/portfolio';
import { accountKey, assetKey, heldOn, isDerivative, replay, tradeDate } from '@/lib/domain/portfolio/positions';
import { loadSplits } from '@/lib/services/market/store';
import type { Draft } from '@/lib/domain/import/formats';
import { qty as fmtQty } from '@/lib/format';

export type TradeActionState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function toNumber(value: FormDataEntryValue | null): number | undefined {
  if (value == null || value.toString().trim() === '') return undefined;
  const n = Number(value.toString().replace(/,/g, ''));
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
  revalidatePath('/', 'layout');
}

/** A platform typed in a form or found in an import joins the user's list. */
async function rememberPlatforms(userId: string, names: string[]) {
  const supabase = await supabaseServer();
  const { data: settings } = await supabase.from('user_settings').select('platforms').maybeSingle();
  const current = normalizePlatforms(settings?.platforms as string[] | null);
  const known = new Set(current.map((p) => p.toLowerCase()));
  const added = Array.from(new Set(names.map((n) => n.trim()).filter((n) => n && !known.has(n.toLowerCase()))));
  if (!added.length) return;
  await supabase.from('user_settings').upsert({ user_id: userId, platforms: normalizePlatforms([...current, ...added]) }, { onConflict: 'user_id' });
}

function tradePayload(t: TradeInput, source = t.source): TradesUpsertPayload {
  const c = isDerivative(t.asset.type) ? t.contract : undefined;
  return {
    occurred_at: t.occurredAt,
    asset_symbol: t.asset.symbol,
    asset_type: t.asset.type,
    asset_name: t.asset.name ?? null,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    fees: t.fees,
    currency: t.currency,
    platform: t.platform ?? 'Manual',
    source,
    notes: t.notes ?? null,
    // Always written on edit so clearing the override sticks.
    fx_rate: t.fxRate ?? null,
    fx_quote: t.fxRate ? (t.fxQuote ?? null) : null,
    external_id: t.externalId ?? null,
    underlying: c?.underlying ?? null,
    expiry: c?.expiry ?? null,
    strike: c?.strike ?? null,
    option_type: t.asset.type === 'option' ? (c?.optionType ?? null) : null,
    lot_size: c?.lotSize ?? null,
  };
}

function cashPayload(c: CashInput): CashUpsertPayload {
  return {
    occurred_at: c.occurredAt,
    kind: c.kind,
    amount: c.amount,
    currency: c.currency,
    platform: c.platform,
    asset_symbol: c.assetSymbol ?? null,
    asset_type: c.assetSymbol ? (c.assetType ?? null) : null,
    notes: c.notes ?? null,
    external_id: c.externalId ?? null,
  };
}

async function reportedSplits(symbol: string, type: string) {
  const supabase = await supabaseServer();
  return loadSplits(supabase, [{ key: assetKey(symbol, type), symbol, type }]);
}

/**
 * Stocks can't be sold short: a sell must not exceed what the log shows held on that platform that day.
 * Returns an error message, or undefined when the sell fits.
 */
async function checkSell(t: TradeInput, editingId: string | undefined, others: AppTrade[]): Promise<string | undefined> {
  if (t.side !== 'SELL' || isDerivative(t.asset.type)) return undefined;
  const key = accountKey(t.platform, t.asset.symbol, t.asset.type);
  const same = others.filter((o) => o.id !== editingId && accountKey(o.platform, o.asset.symbol, o.asset.type) === key);
  const splits = await reportedSplits(t.asset.symbol, t.asset.type);
  const candidate: AppTrade = {
    id: editingId ?? 'new',
    occurredAt: t.occurredAt,
    asset: { symbol: t.asset.symbol, type: t.asset.type },
    side: 'SELL',
    quantity: t.quantity,
    price: t.price,
    platform: t.platform,
  };
  const oversold = (list: AppTrade[]) => replay(list, { splits, includeClosed: true }).positions.reduce((s, p) => s + p.oversold, 0);
  if (oversold([...same, candidate]) <= oversold(same) + 1e-9) return undefined;
  const held = heldOn(same, t.asset, t.platform, tradeDate(t), splits);
  return held > 0
    ? `You held ${fmtQty(held)} on ${t.platform} at that date. Sell up to that, or add the missing buy first.`
    : `No ${t.asset.symbol} on ${t.platform} at that date. Add the buy first, or pick the platform you bought on.`;
}

/**
 * Create or update a trade. Validates with Zod, checks a sell against holdings, adds a new
 * platform to settings, then returns the user to `returnTo`.
 */
export async function saveTradeAction(
  _prevState: TradeActionState | undefined,
  formData: FormData
): Promise<TradeActionState> {
  const user = await getUser();
  if (!user) return { ok: false, message: 'Your session ended. Sign in again to save this trade.' };

  const tradeId = toStringVal(formData.get('tradeId'));
  const fxOverride = formData.get('fxOverride') === 'on';
  const assetType = toStringVal(formData.get('assetType'));
  const derivative = assetType === 'future' || assetType === 'option';

  const raw = {
    // The browser sends the user's local date and time already converted to an ISO timestamp.
    occurredAt: toStringVal(formData.get('occurredAt')),
    asset: {
      symbol: toStringVal(formData.get('symbol')),
      type: assetType,
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
    contract: derivative
      ? {
          underlying: toStringVal(formData.get('underlying')),
          expiry: toStringVal(formData.get('expiry')),
          strike: assetType === 'option' ? toNumber(formData.get('strike')) : undefined,
          optionType: assetType === 'option' ? toStringVal(formData.get('optionType')) : undefined,
          lotSize: toNumber(formData.get('lotSize')),
        }
      : undefined,
  };

  const parsed = tradeSchema.safeParse(raw);
  const missingRate = fxOverride && raw.fxRate === undefined;
  if (!parsed.success || missingRate) {
    const flat = (parsed.success ? {} : parsed.error.flatten().fieldErrors) as Record<string, string[]>;
    if (missingRate) flat.fxRate = ['Enter the rate your broker used'];
    return { ok: false, message: 'Check the highlighted fields.', fieldErrors: flat };
  }

  const trade = parsed.data;
  const supabase = await supabaseServer();
  const ledger = await loadLedger(supabase);
  const sellError = await checkSell(trade, tradeId, ledger.trades);
  if (sellError) return { ok: false, message: sellError, fieldErrors: { quantity: [sellError] } };

  const res = await upsertTrade({ tradeId, userId: user.id, payload: tradePayload(trade) });
  if (!res.ok) {
    console.error('[trades] save failed', res.message);
    return { ok: false, message: "The trade wasn't saved because the database didn't accept it. Try again in a moment." };
  }

  await rememberPlatforms(user.id, [trade.platform]);
  revalidateAll();
  redirect(safeReturn(formData.get('returnTo'), '/trades'));
}

export async function deleteTradeAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) redirect('/login');

  const tradeId = toStringVal(formData.get('tradeId'));
  if (tradeId) {
    const res = await deleteRows('trades', [tradeId], user.id);
    if (!res.ok) console.error('[trades] delete failed', res.message);
  }

  revalidateAll();
  redirect(safeReturn(formData.get('returnTo'), '/trades'));
}

/** Create or update a deposit, withdrawal, dividend, interest or fee. */
export async function saveCashAction(
  _prevState: TradeActionState | undefined,
  formData: FormData
): Promise<TradeActionState> {
  const user = await getUser();
  if (!user) return { ok: false, message: 'Your session ended. Sign in again to save this.' };

  const id = toStringVal(formData.get('cashId'));
  const kind = toStringVal(formData.get('kind'));
  const symbol = toStringVal(formData.get('assetSymbol'));
  const parsed = cashSchema.safeParse({
    occurredAt: toStringVal(formData.get('occurredAt')),
    kind,
    amount: toNumber(formData.get('amount')),
    currency: toStringVal(formData.get('currency')),
    platform: toStringVal(formData.get('platform')),
    assetSymbol: kind === 'dividend' || kind === 'interest' ? symbol : undefined,
    assetType: symbol ? toStringVal(formData.get('assetType')) : undefined,
    notes: toStringVal(formData.get('notes')),
  });
  if (!parsed.success) {
    return { ok: false, message: 'Check the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const res = await upsertCash({ id, userId: user.id, payload: cashPayload(parsed.data) });
  if (!res.ok) {
    console.error('[cash] save failed', res.message);
    return { ok: false, message: "It wasn't saved because the database didn't accept it. Try again in a moment." };
  }
  await rememberPlatforms(user.id, [parsed.data.platform]);
  revalidateAll();
  redirect(safeReturn(formData.get('returnTo'), '/trades'));
}

export async function deleteCashAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) redirect('/login');
  const id = toStringVal(formData.get('cashId'));
  if (id) {
    const res = await deleteRows('cash_entries', [id], user.id);
    if (!res.ok) console.error('[cash] delete failed', res.message);
  }
  revalidateAll();
  redirect(safeReturn(formData.get('returnTo'), '/trades'));
}

const idList = z.array(z.string().uuid()).max(1000);

/**
 * Delete several rows from the activity log at once. `ids` are "trade:<uuid>" or "cash:<uuid>".
 * No redirect: the table refreshes itself and clears its selection.
 */
export async function deleteEntriesAction(ids: string[]): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) redirect('/login');
  const trades = idList.safeParse(ids.filter((s) => s.startsWith('trade:')).map((s) => s.slice(6)));
  const cash = idList.safeParse(ids.filter((s) => s.startsWith('cash:')).map((s) => s.slice(5)));
  if (!trades.success || !cash.success) return { ok: false };
  const [t, c] = await Promise.all([deleteRows('trades', trades.data, user.id), deleteRows('cash_entries', cash.data, user.id)]);
  revalidateAll();
  return { ok: t.ok && c.ok };
}

export type ImportResult = {
  ok: boolean;
  message: string;
  added?: number;
  skipped?: number;
  failed?: { line: number; message: string }[];
};

const draftsSchema = z.array(z.object({ line: z.number().int(), draft: z.record(z.string(), z.unknown()) })).max(20000);

/** Same trade already saved? Compared on what a statement shows, to the minute. */
function fingerprint(r: { occurred_at: string; asset_symbol?: string; side?: string; kind?: string; quantity?: number | string; price?: number | string; amount?: number | string; platform: string | null }) {
  const minute = new Date(r.occurred_at).toISOString().slice(0, 16);
  return [minute, r.asset_symbol ?? '', r.side ?? r.kind ?? '', Number(r.quantity ?? 0), Number(r.price ?? r.amount ?? 0), (r.platform ?? 'Manual').toLowerCase()].join('|');
}

/**
 * Save previewed CSV rows. Each is validated again; rows already saved (same broker id, or same
 * date, symbol, side, quantity, price and platform) are skipped, so importing a file twice is safe.
 */
export async function importAction(json: string): Promise<ImportResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: 'Your session ended. Sign in again to import.' };

  let input: { line: number; draft: Record<string, unknown> }[];
  try {
    const parsed = draftsSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return { ok: false, message: 'The file is too large or not readable. Split it and try again.' };
    input = parsed.data;
  } catch {
    return { ok: false, message: 'Something went wrong reading the rows. Reload and try again.' };
  }

  const supabase = await supabaseServer();
  const ledger = await loadLedger(supabase);
  const seenIds = new Set<string>([
    ...ledger.trades.flatMap((t) => [t.id, t.externalId ?? '']),
    ...ledger.cash.flatMap((c) => [c.id, c.externalId ?? '']),
  ]);
  const seen = new Set<string>([
    ...ledger.trades.map((t) =>
      fingerprint({ occurred_at: t.occurredAt, asset_symbol: t.asset.symbol, side: t.side, quantity: t.quantity, price: t.price, platform: t.platform })
    ),
    ...ledger.cash.map((c) => fingerprint({ occurred_at: c.occurredAt, asset_symbol: c.assetSymbol ?? '', kind: c.kind, amount: c.amount, platform: c.platform })),
  ]);

  const trades: TradesUpsertPayload[] = [];
  const cash: CashUpsertPayload[] = [];
  const failed: { line: number; message: string }[] = [];
  let skipped = 0;

  for (const { line, draft } of input) {
    const d = draft as Draft;
    if (d.externalId && seenIds.has(d.externalId)) {
      skipped++;
      continue;
    }
    if (d.kind === 'cash') {
      const p = cashSchema.safeParse({ ...d, kind: d.cashKind });
      if (!p.success) {
        failed.push({ line, message: p.error.issues[0]?.message ?? 'Invalid row' });
        continue;
      }
      const row = cashPayload(p.data);
      const fp = fingerprint({ ...row, asset_symbol: row.asset_symbol ?? '' });
      if (seen.has(fp)) {
        skipped++;
        continue;
      }
      seen.add(fp);
      cash.push(row);
    } else {
      const p = tradeSchema.safeParse({
        occurredAt: d.occurredAt,
        asset: { symbol: d.symbol, type: d.assetType, name: d.assetName },
        side: d.side,
        quantity: d.quantity,
        price: d.price,
        fees: d.fees,
        currency: d.currency,
        fxRate: d.fxRate,
        fxQuote: d.fxQuote,
        platform: d.platform,
        source: 'import',
        notes: d.notes,
        externalId: d.externalId,
        contract:
          d.assetType === 'future' || d.assetType === 'option'
            ? { underlying: d.underlying, expiry: d.expiry, strike: d.strike, optionType: d.optionType, lotSize: d.lotSize }
            : undefined,
      });
      if (!p.success) {
        failed.push({ line, message: p.error.issues[0]?.message ?? 'Invalid row' });
        continue;
      }
      const row = tradePayload(p.data, 'import');
      const fp = fingerprint(row);
      if (seen.has(fp)) {
        skipped++;
        continue;
      }
      seen.add(fp);
      trades.push(row);
    }
    if (d.externalId) seenIds.add(d.externalId);
  }

  const [t, c] = [await insertMany('trades', user.id, trades), await insertMany('cash_entries', user.id, cash)];
  await rememberPlatforms(user.id, [...trades.map((r) => r.platform), ...cash.map((r) => r.platform)]);
  revalidateAll();

  const added = t.inserted + c.inserted;
  const error = t.error ?? c.error;
  if (error) console.error('[import] insert failed', error);
  return {
    ok: !error,
    message: error
      ? `Saved ${added} rows, then the database stopped accepting them. Import the file again to add the rest; saved rows will be skipped.`
      : `Imported ${added} ${added === 1 ? 'row' : 'rows'}${skipped ? `, skipped ${skipped} already saved` : ''}${failed.length ? `, ${failed.length} couldn't be read` : ''}.`,
    added,
    skipped,
    failed,
  };
}
