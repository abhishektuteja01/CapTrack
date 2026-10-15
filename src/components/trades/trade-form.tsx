'use client';

import { useActionState, useEffect, useId, useState, useSyncExternalStore } from 'react';
import { deleteTradeAction, saveTradeAction, type TradeActionState } from '@/app/(app)/trades/actions';
import type { EditableTrade } from '@/lib/trades';
import { money, price as fmtPrice, rate as fmtRate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SymbolAutocomplete, { inputClass, type SymbolSuggestion } from './symbol-autocomplete';

const ASSET_TYPES = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual fund' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'cash', label: 'Cash' },
];
const NEW_PLATFORM = '__new__';

const subscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string[];
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">
        {label}
      </label>
      {children}
      {error?.length ? (
        <p className="text-2xs text-neg">{error[0]}</p>
      ) : hint ? (
        <p className="text-2xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Add or edit a trade. Side first, then what and where, then the numbers with a live total.
 * Currency comes from the symbol's quote; non-base currencies show the rate on the trade date.
 */
export default function TradeForm({
  trade,
  platforms,
  baseCurrency,
  returnTo,
  onCancel,
}: {
  trade?: EditableTrade;
  platforms: string[];
  baseCurrency: string;
  returnTo: string;
  onCancel?: () => void;
}) {
  const [state, formAction, saving] = useActionState<TradeActionState | undefined, FormData>(saveTradeAction, undefined);
  const id = useId();
  const isClient = useIsClient();

  const [side, setSide] = useState<'BUY' | 'SELL'>(trade?.side ?? 'BUY');
  const [symbol, setSymbol] = useState(trade?.symbol ?? '');
  const [assetName, setAssetName] = useState(trade?.assetName ?? '');
  const [assetType, setAssetType] = useState(trade?.assetType ?? 'stock');
  const [platform, setPlatform] = useState(trade?.platform ?? platforms[0] ?? 'Manual');
  const [newPlatform, setNewPlatform] = useState('');
  const [when, setWhen] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(trade ? String(trade.quantity) : '');
  const [unitPrice, setUnitPrice] = useState(trade ? String(trade.price) : '');
  const [fees, setFees] = useState(trade ? String(trade.fees) : '');
  const [currency, setCurrency] = useState(trade?.currency ?? baseCurrency);
  const [lastPrice, setLastPrice] = useState<{ price: number; currency: string } | null>(null);
  const [fxOverride, setFxOverride] = useState(Boolean(trade?.fxRate));
  const [fxRate, setFxRate] = useState(trade?.fxRate ? String(trade.fxRate) : '');
  const [marketRate, setMarketRate] = useState<{ rate: number; date: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [edited, setEdited] = useState<Set<string>>(new Set());

  // The date input renders on the client only, so it uses the viewer's time zone.
  const localWhen = when ?? (isClient ? toLocalInput(trade?.occurredAt ?? new Date().toISOString()) : '');
  const tradeDay = localWhen.slice(0, 10);
  const isoWhen = localWhen ? new Date(localWhen).toISOString() : '';

  const err = (name: string) =>
    !edited.has(name) && state && !state.ok ? state.fieldErrors?.[name] : undefined;
  const touch = (name: string) => setEdited((s) => (s.has(name) ? s : new Set(s).add(name)));

  // Market rate on the trade date for a non-base currency.
  const needsFx = /^[A-Z]{3}$/.test(currency) && currency !== baseCurrency;
  useEffect(() => {
    if (!needsFx || !tradeDay) return;
    const ctrl = new AbortController();
    fetch(`/api/fx?from=${currency}&to=${baseCurrency}&date=${tradeDay}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rate?: number; date?: string } | null) => setMarketRate(j?.rate ? { rate: j.rate, date: j.date ?? tradeDay } : null))
      .catch(() => {});
    return () => ctrl.abort();
  }, [needsFx, currency, baseCurrency, tradeDay]);

  // A typed symbol (no suggestion picked) still gets its name and currency from the quote.
  useEffect(() => {
    const sym = symbol.trim();
    if (!sym || assetName || sym === trade?.symbol) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/quote?symbol=${encodeURIComponent(sym)}&type=${assetType}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((q: { currency?: string; price?: number; name?: string } | null) => {
          if (!q?.currency) return;
          setCurrency(q.currency);
          if (q.name) setAssetName(q.name);
          if (q.price) setLastPrice({ price: q.price, currency: q.currency });
        })
        .catch(() => {});
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [symbol, assetName, assetType, trade?.symbol]);

  function onPick(s: SymbolSuggestion) {
    setSymbol(s.symbol);
    setAssetName(s.name);
    touch('asset');
    const type = s.type === 'fund' ? 'mutual_fund' : s.type === 'other' ? 'stock' : s.type;
    setAssetType(type);
    fetch(`/api/quote?symbol=${encodeURIComponent(s.symbol)}&type=${type}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((q: { currency?: string; price?: number } | null) => {
        if (q?.currency) setCurrency(q.currency);
        if (q?.price && q.currency) setLastPrice({ price: q.price, currency: q.currency });
      })
      .catch(() => {});
  }

  const qtyN = Number(quantity) || 0;
  const priceN = Number(unitPrice) || 0;
  const feesN = Number(fees) || 0;
  const gross = qtyN * priceN;
  const total = side === 'BUY' ? gross + feesN : gross - feesN;
  const rateUsed = !needsFx ? 1 : fxOverride ? Number(fxRate) || undefined : marketRate?.rate;
  const platformValue = platform === NEW_PLATFORM ? newPlatform : platform;
  const tradePlatform = trade?.platform;
  const platformOptions =
    tradePlatform && !platforms.includes(tradePlatform) ? [...platforms, tradePlatform] : platforms;

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {trade ? <input type="hidden" name="tradeId" value={trade.id} /> : null}
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="side" value={side} />
        <input type="hidden" name="occurredAt" value={isoWhen} />
        <input type="hidden" name="symbol" value={symbol.trim()} />
        <input type="hidden" name="assetName" value={assetName} />
        <input type="hidden" name="platform" value={platformValue} />
        <input type="hidden" name="fxQuote" value={baseCurrency} />

        {/* Side */}
        <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 rounded-md border border-line-strong p-0.5">
          {(['BUY', 'SELL'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
              className={cn(
                'h-7 rounded-sm text-[13px] font-medium text-ink-2',
                side === s && 'bg-ink text-surface'
              )}
            >
              {s === 'BUY' ? 'Buy' : 'Sell'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field
            label="Symbol"
            htmlFor={`${id}-symbol`}
            error={err('asset')}
            hint={
              assetName
                ? `${assetName}${lastPrice ? ` · last ${fmtPrice(lastPrice.price, lastPrice.currency)}` : ''}`
                : 'Yahoo Finance symbol. Indian stocks end in .NS or .BO.'
            }
          >
            <SymbolAutocomplete
              id={`${id}-symbol`}
              value={symbol}
              invalid={Boolean(err('asset'))}
              onChange={(text) => {
                setSymbol(text);
                setAssetName('');
                setLastPrice(null);
                touch('asset');
              }}
              onSelect={onPick}
            />
          </Field>
          <Field label="Type" htmlFor={`${id}-type`}>
            <select
              id={`${id}-type`}
              name="assetType"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className={inputClass}
            >
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date and time" htmlFor={`${id}-when`} error={err('occurredAt')}>
            {isClient ? (
              <input
                id={`${id}-when`}
                type="datetime-local"
                value={localWhen}
                onChange={(e) => {
                  setWhen(e.target.value);
                  touch('occurredAt');
                }}
                className={cn(inputClass, 'num')}
              />
            ) : (
              <div className={cn(inputClass, 'bg-subtle')} />
            )}
          </Field>
          <Field label="Platform" htmlFor={`${id}-platform`} error={err('platform')}>
            <select
              id={`${id}-platform`}
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={inputClass}
            >
              {platformOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value={NEW_PLATFORM}>New platform…</option>
            </select>
            {platform === NEW_PLATFORM ? (
              <input
                aria-label="New platform name"
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                placeholder="e.g. Groww"
                maxLength={64}
                className={cn(inputClass, 'mt-1')}
                autoFocus
              />
            ) : null}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Quantity" htmlFor={`${id}-qty`} error={err('quantity')}>
            <input
              id={`${id}-qty`}
              name="quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                touch('quantity');
              }}
              aria-invalid={Boolean(err('quantity')) || undefined}
              className={cn(inputClass, 'num text-right')}
            />
          </Field>
          <Field label="Price per unit" htmlFor={`${id}-price`} error={err('price')}>
            <input
              id={`${id}-price`}
              name="price"
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => {
                setUnitPrice(e.target.value);
                touch('price');
              }}
              aria-invalid={Boolean(err('price')) || undefined}
              className={cn(inputClass, 'num text-right')}
            />
          </Field>
          <Field label="Fees" htmlFor={`${id}-fees`} error={err('fees')}>
            <input
              id={`${id}-fees`}
              name="fees"
              inputMode="decimal"
              value={fees}
              placeholder="0"
              onChange={(e) => {
                setFees(e.target.value);
                touch('fees');
              }}
              className={cn(inputClass, 'num text-right')}
            />
          </Field>
          <Field label="Currency" htmlFor={`${id}-ccy`} error={err('currency')}>
            <input
              id={`${id}-ccy`}
              name="currency"
              value={currency}
              maxLength={3}
              onChange={(e) => {
                setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''));
                touch('currency');
              }}
              aria-invalid={Boolean(err('currency')) || undefined}
              className={cn(inputClass, 'num uppercase')}
            />
          </Field>
        </div>

        {needsFx ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-hover px-3 py-2">
            <p className="num text-2xs text-ink-2">
              {marketRate
                ? `1 ${currency} = ${fmtRate(marketRate.rate)} ${baseCurrency} on ${marketRate.date}`
                : `Looking up the ${currency}/${baseCurrency} rate for this date…`}
            </p>
            <label className="flex items-center gap-2 text-2xs text-ink-2">
              <input
                type="checkbox"
                name="fxOverride"
                checked={fxOverride}
                onChange={(e) => setFxOverride(e.target.checked)}
                className="accent-accent"
              />
              My broker used a different rate
            </label>
            {fxOverride ? (
              <Field label={`${baseCurrency} per 1 ${currency}`} htmlFor={`${id}-fx`} error={err('fxRate')}>
                <input
                  id={`${id}-fx`}
                  name="fxRate"
                  inputMode="decimal"
                  value={fxRate}
                  onChange={(e) => {
                    setFxRate(e.target.value);
                    touch('fxRate');
                  }}
                  className={cn(inputClass, 'num w-40 text-right')}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        <Field label="Notes" htmlFor={`${id}-notes`}>
          <textarea
            id={`${id}-notes`}
            name="notes"
            defaultValue={trade?.notes ?? ''}
            rows={2}
            maxLength={500}
            className={cn(inputClass, 'h-auto py-1.5')}
          />
        </Field>

        {/* Live total */}
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <span className="text-2xs text-ink-3">
            {side === 'BUY' ? 'You pay' : 'You receive'}
            {feesN ? ` (${side === 'BUY' ? 'incl.' : 'after'} fees)` : ''}
          </span>
          <span className="text-right">
            <span className="num block text-[15px] font-medium">
              {/^[A-Z]{3}$/.test(currency) ? money(total, currency) : '—'}
            </span>
            {needsFx && rateUsed ? (
              <span className="num block text-2xs text-ink-3">≈ {money(total * rateUsed, baseCurrency)}</span>
            ) : null}
          </span>
        </div>

        {state && !state.ok && (!state.fieldErrors || Object.keys(state.fieldErrors).some((k) => !edited.has(k))) ? (
          <p role="alert" className="text-[13px] text-neg">
            {state.message}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : trade ? 'Save changes' : side === 'BUY' ? 'Add buy' : 'Add sell'}
          </Button>
        </div>
      </form>

      {trade ? (
        <form action={deleteTradeAction} className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <input type="hidden" name="tradeId" value={trade.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {confirmDelete ? (
            <>
              <span className="text-2xs text-ink-2">Delete this trade? Positions and history will be recalculated.</span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
                <Button size="sm" variant="danger" type="submit">
                  Delete
                </Button>
              </span>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="text-neg" onClick={() => setConfirmDelete(true)}>
              Delete trade
            </Button>
          )}
        </form>
      ) : null}
    </div>
  );
}
