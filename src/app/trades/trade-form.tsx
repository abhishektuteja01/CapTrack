// src/app/trades/trade-form.tsx
'use client';

import React from 'react';
import { createTradeAction } from './actions';
import SymbolAutocomplete, { SymbolSuggestion } from './symbol-autocomplete';

const nowDateTimeLocal = () => {
  const d = new Date();
  // Convert to local time and format as YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

type Props = {
  portfolioId: string;
  platforms: string[];
  editTrade?: {
    id: string;
    occurredAtLocal: string;
    symbol: string;
    assetType: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    fees: number;
    currency: string;
    platform?: string | null;
    notes: string | null;
  };
};

type ActionState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export default function TradeForm({ portfolioId, editTrade, platforms }: Props) {
  const [state, formAction] = React.useActionState<ActionState, FormData>(createTradeAction, undefined);

  const [symbol, setSymbol] = React.useState(editTrade?.symbol ?? '');
  const [assetType, setAssetType] = React.useState(editTrade?.assetType ?? 'stock');
  const [currency, setCurrency] = React.useState(editTrade?.currency ?? 'USD');
  const [platform, setPlatform] = React.useState(
    editTrade?.platform ?? platforms?.[0] ?? 'Manual'
  );

  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const markTouched = (name: string) => setTouched((t) => ({ ...t, [name]: true }));

  const fieldErr = (name: string) => {
    // If user has changed the field since the last server validation, hide the stale error.
    if (touched[name]) return undefined;
    return state && 'fieldErrors' in state ? state.fieldErrors?.[name] : undefined;
  };

  return (
    <form action={formAction} style={{ display: 'grid', gap: 12 }}>
      <input type="hidden" name="portfolioId" value={portfolioId} />
      {editTrade?.id ? <input type="hidden" name="tradeId" value={editTrade.id} /> : null}

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Occurred At</label>
        <div className="w-full overflow-hidden rounded-md border-2 border-zinc-300 bg-white">
          <input
            name="occurredAt"
            type="datetime-local"
            required
            defaultValue={editTrade?.occurredAtLocal ?? nowDateTimeLocal()}
            onChange={() => markTouched('occurredAt')}
            className="w-full min-w-0 appearance-none bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
        {fieldErr('occurredAt')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Symbol</label>
        <SymbolAutocomplete
          value={symbol}
          onSelect={(s: SymbolSuggestion) => {
            setSymbol(s.symbol);
            markTouched('asset');
            setAssetType(s.type);
            // Infer currency (v1 rules)
            if (s.type === 'crypto') {
              setCurrency('USD');
            } else if (s.symbol.endsWith('.NS')) {
              setCurrency('INR');
            } else {
              setCurrency('USD');
            }
          }}
        />
        <input type="hidden" name="symbol" value={symbol} />
        {fieldErr('asset')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Asset Type</label>
        <select
          name="assetType"
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
          required
          className="w-full rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
        >
          <option value="stock">stock</option>
          <option value="etf">etf</option>
          <option value="mutual_fund">mutual_fund</option>
          <option value="crypto">crypto</option>
          <option value="cash">cash</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Side</label>
        <select name="side" defaultValue={editTrade?.side ?? 'BUY'} required className="w-full rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none">
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Platform</label>
        <select
          name="platform"
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value);
            markTouched('platform');
          }}
          className="w-full rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
        >
          {(platforms?.length ? platforms : ['Manual']).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {fieldErr('platform')?.map((e) => (
          <small key={e} style={{ color: 'crimson' }}>
            {e}
          </small>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Quantity</label>
        <input
          name="quantity"
          type="number"
          step="any"
          min="0"
          required
          defaultValue={editTrade?.quantity}
          onChange={() => markTouched('quantity')}
          className="w-full max-w-full min-w-0 box-border rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
        />
        {fieldErr('quantity')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Price (per unit)</label>
        <input
          name="price"
          type="number"
          step="any"
          min="0"
          required
          defaultValue={editTrade?.price}
          onChange={() => markTouched('price')}
          className="w-full max-w-full min-w-0 box-border rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
        />
        {fieldErr('price')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Fees</label>
        <input
          name="fees"
          type="number"
          step="any"
          min="0"
          defaultValue={editTrade?.fees ?? 0}
          onChange={() => markTouched('fees')}
          className="w-full max-w-full min-w-0 box-border rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
        />
        {fieldErr('fees')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Currency</label>
        <small className="text-xs text-zinc-500">Auto-filled from symbol (locked)</small>
        {/* Disabled display input (not submitted) */}
        <input
          value={currency}
          readOnly
          aria-readonly="true"
          className="w-full max-w-full min-w-0 box-border cursor-not-allowed rounded-md border-2 border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
        />
        {/* Hidden input to ensure server action receives currency */}
        <input type="hidden" name="currency" value={currency} />
        <small className="text-xs text-zinc-500">To change currency, select a different ticker symbol.</small>
        {fieldErr('currency')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label className="text-sm font-semibold text-zinc-900">Notes</label>
        <textarea name="notes" rows={3} defaultValue={editTrade?.notes ?? ''} onChange={() => markTouched('notes')} className="w-full max-w-full min-w-0 box-border rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none" />
      </div>

      {editTrade ? (
        <a
          href="/trades"
          className="text-sm font-semibold text-zinc-700 underline"
        >
          Cancel editing
        </a>
      ) : null}

      <button
        type="submit"
        className="mt-2 inline-flex items-center justify-center rounded-md border-2 border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        {editTrade ? 'Save Changes' : 'Add Trade'}
      </button>

      {state?.message ? (
        <p style={{ marginTop: 8, color: state.ok ? 'green' : 'crimson' }}>{state.message}</p>
      ) : null}
    </form>
  );
}