// src/app/trades/trade-form.tsx
'use client';

import React from 'react';
import { createTradeAction } from '@/app/(app)/trades/actions';
import SymbolAutocomplete, { SymbolSuggestion } from './symbol-autocomplete';
import { FadeIn } from '../ui/fade-in';
import { motion } from 'framer-motion';

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

  const inputClass = "w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-sm transition-all outline-none focus:border-zinc-900 focus:bg-white focus:ring-1 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white dark:focus:border-white dark:focus:bg-black dark:focus:ring-white";
  const labelClass = "text-xs font-medium text-zinc-500 uppercase tracking-wide dark:text-zinc-400";
  const errorClass = "text-xs text-rose-600 mt-1 dark:text-rose-400";

  return (
    <FadeIn delay={0.1} className="w-full max-w-2xl mx-auto">
      <form action={formAction} className="space-y-8">
        <input type="hidden" name="portfolioId" value={portfolioId} />
        {editTrade?.id ? <input type="hidden" name="tradeId" value={editTrade.id} /> : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClass}>Occurred At</label>
            <input
              name="occurredAt"
              type="datetime-local"
              required
              defaultValue={editTrade?.occurredAtLocal ?? nowDateTimeLocal()}
              onChange={() => markTouched('occurredAt')}
              className={inputClass}
            />
            {fieldErr('occurredAt')?.map((e) => <div key={e} className={errorClass}>{e}</div>)}
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Platform</label>
            <div className="relative">
              <select
                name="platform"
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  markTouched('platform');
                }}
                className={`${inputClass} appearance-none pr-8`}
              >
                {(platforms?.length ? platforms : ['Manual']).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            {fieldErr('platform')?.map((e) => (
              <div key={e} className={errorClass}>
                {e}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Symbol</label>
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
          {fieldErr('asset')?.map((e) => <div key={e} className={errorClass}>{e}</div>)}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClass}>Asset Type</label>
            <div className="relative">
              <select
                name="assetType"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                required
                className={`${inputClass} appearance-none pr-8`}
              >
                <option value="stock">Stock</option>
                <option value="etf">ETF</option>
                <option value="mutual_fund">Mutual Fund</option>
                <option value="crypto">Crypto</option>
                <option value="cash">Cash</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Side</label>
            <div className="relative">
              <select name="side" defaultValue={editTrade?.side ?? 'BUY'} required className={`${inputClass} appearance-none pr-8`}>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClass}>Quantity</label>
            <input
              name="quantity"
              type="number"
              step="any"
              min="0"
              required
              defaultValue={editTrade?.quantity}
              onChange={() => markTouched('quantity')}
              className={inputClass}
              placeholder="0.00"
            />
            {fieldErr('quantity')?.map((e) => <div key={e} className={errorClass}>{e}</div>)}
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Price (per unit)</label>
            <input
              name="price"
              type="number"
              step="any"
              min="0"
              required
              defaultValue={editTrade?.price}
              onChange={() => markTouched('price')}
              className={inputClass}
              placeholder="0.00"
            />
            {fieldErr('price')?.map((e) => <div key={e} className={errorClass}>{e}</div>)}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClass}>Fees</label>
            <input
              name="fees"
              type="number"
              step="any"
              min="0"
              defaultValue={editTrade?.fees ?? 0}
              onChange={() => markTouched('fees')}
              className={inputClass}
              placeholder="0.00"
            />
            {fieldErr('fees')?.map((e) => <div key={e} className={errorClass}>{e}</div>)}
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Currency</label>
            <input
              value={currency}
              readOnly
              aria-readonly="true"
              className={`${inputClass} bg-zinc-100 text-zinc-500 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500`}
            />
            <input type="hidden" name="currency" value={currency} />
            <p className="text-[10px] text-zinc-500 dark:text-zinc-500">Auto-filled based on symbol.</p>
            {fieldErr('currency')?.map((e) => <div key={e} className={errorClass}>{e}</div>)}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={editTrade?.notes ?? ''}
            onChange={() => markTouched('notes')}
            className={`${inputClass} resize-none`}
            placeholder="Optional notes about this trade..."
          />
        </div>

        <div className="pt-4 flex items-center justify-end gap-4">
          {editTrade ? (
            <a
              href="/trades"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:text-white"
            >
              Cancel
            </a>
          ) : null}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/10 hover:bg-zinc-800 hover:shadow-zinc-900/20 active:scale-95 transition-all dark:bg-white dark:text-black dark:shadow-white/10 dark:hover:bg-zinc-200"
          >
            {editTrade ? 'Save Changes' : 'Add Trade'}
          </motion.button>
        </div>

        {state?.message ? (
          <div className={`rounded-xl px-4 py-3 text-sm ${state.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-400'}`}>
            {state.message}
          </div>
        ) : null}
      </form>
    </FadeIn>
  );
}