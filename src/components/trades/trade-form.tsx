'use client';

import { useActionState, useEffect, useId, useState, useSyncExternalStore } from 'react';
import { deleteTradeAction, saveTradeAction, type TradeActionState } from '@/app/(app)/trades/actions';
import type { EditableTrade, OpenAccount } from '@/lib/trades';
import type { CostMethod } from '@/lib/domain/portfolio/positions';
import { money, moneyDelta, price as fmtPrice, qty as fmtQty, rate as fmtRate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { toneClass } from '@/components/ui/num';
import { cn } from '@/lib/utils';
import SymbolAutocomplete, { inputClass, searchContracts, type SymbolSuggestion } from './symbol-autocomplete';

export const ASSET_TYPES = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual fund' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'future', label: 'Future (NSE)' },
  { value: 'option', label: 'Option (NSE)' },
  { value: 'other', label: 'Other' },
];
const NEW_PLATFORM = '__new__';

const subscribe = () => () => {};
export function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function Field({
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

export type TradePrefill = Partial<{
  symbol: string;
  assetType: string;
  side: 'BUY' | 'SELL';
  platform: string;
  quantity: number;
}>;

/** What selling `units` at `unitPrice` (fees spread per unit) would realize from these lots. */
function estimatePnl(account: OpenAccount, units: number, unitPrice: number, fees: number, method: CostMethod) {
  if (!(units > 0) || account.quantity <= 0) return undefined;
  const exit = unitPrice - fees / units;
  const sell = Math.min(units, account.quantity);
  if (method === 'average') return sell * (exit - account.avgCost);
  let left = sell;
  let pnl = 0;
  for (const lot of account.lots) {
    if (left <= 0) break;
    const take = Math.min(left, lot.qty);
    pnl += take * (exit - lot.unitCost);
    left -= take;
  }
  return pnl;
}

const SELL_SHARES = [
  { label: '¼', f: 0.25 },
  { label: '½', f: 0.5 },
  { label: 'All', f: 1 },
];

/**
 * Add or edit a trade. Side first, then what and where, then the numbers with a live total.
 * Selling shows what you hold on that platform and the profit it would realize.
 * Currency comes from the symbol's quote; non-base currencies show the rate on the trade date.
 */
export default function TradeForm({
  trade,
  prefill,
  holdings = [],
  costMethod = 'fifo',
  platforms,
  baseCurrency,
  returnTo,
  onCancel,
}: {
  trade?: EditableTrade;
  prefill?: TradePrefill;
  holdings?: OpenAccount[];
  costMethod?: CostMethod;
  platforms: string[];
  baseCurrency: string;
  returnTo: string;
  onCancel?: () => void;
}) {
  const [state, formAction, saving] = useActionState<TradeActionState | undefined, FormData>(saveTradeAction, undefined);
  const id = useId();
  const isClient = useIsClient();

  const preset = prefill?.symbol
    ? holdings.find((h) => h.symbol === prefill.symbol && (!prefill.platform || h.platform === prefill.platform)) ??
      holdings.find((h) => h.symbol === prefill.symbol)
    : undefined;

  const [side, setSide] = useState<'BUY' | 'SELL'>(trade?.side ?? prefill?.side ?? 'BUY');
  const [symbol, setSymbol] = useState(trade?.symbol ?? prefill?.symbol ?? '');
  const [assetName, setAssetName] = useState(trade?.assetName ?? preset?.name ?? '');
  const [assetType, setAssetType] = useState(trade?.assetType ?? prefill?.assetType ?? preset?.type ?? 'stock');
  const [platform, setPlatform] = useState(trade?.platform ?? prefill?.platform ?? preset?.platform ?? platforms[0] ?? 'Manual');
  const [newPlatform, setNewPlatform] = useState('');
  const [when, setWhen] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(
    trade ? String(trade.quantity) : prefill?.quantity ? String(prefill.quantity) : ''
  );
  const [unitPrice, setUnitPrice] = useState(trade ? String(trade.price) : '');
  const [fees, setFees] = useState(trade ? String(trade.fees) : '');
  const [currency, setCurrency] = useState(trade?.currency ?? preset?.currency ?? baseCurrency);
  const [lastPrice, setLastPrice] = useState<{ price: number; currency: string } | null>(null);
  const [fxOverride, setFxOverride] = useState(Boolean(trade?.fxRate));
  const [fxRate, setFxRate] = useState(trade?.fxRate ? String(trade.fxRate) : '');
  const [marketRate, setMarketRate] = useState<{ rate: number; date: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [contract, setContract] = useState({
    underlying: trade?.contract?.underlying ?? '',
    expiry: trade?.contract?.expiry ?? '',
    strike: trade?.contract?.strike !== undefined ? String(trade.contract.strike) : '',
    optionType: trade?.contract?.optionType ?? 'CE',
    lotSize: trade?.contract?.lotSize ? String(trade.contract.lotSize) : '',
  });

  const derivative = assetType === 'future' || assetType === 'option';

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
    if (!sym || assetName || derivative || sym === trade?.symbol) return;
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
  }, [symbol, assetName, assetType, derivative, trade?.symbol]);

  function onPick(s: SymbolSuggestion) {
    setSymbol(s.symbol);
    setAssetName(s.name);
    touch('asset');
    if (s.contract) {
      const c = s.contract;
      setAssetType(c.kind);
      setCurrency('INR');
      setContract({
        underlying: c.underlying,
        expiry: c.expiry,
        strike: c.strike !== undefined ? String(c.strike) : '',
        optionType: c.optionType ?? 'CE',
        lotSize: c.lotSize ? String(c.lotSize) : '',
      });
      setLastPrice({ price: c.price, currency: 'INR' });
      return;
    }
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

  function pickHolding(key: string) {
    const h = holdings.find((x) => `${x.platform}|${x.type}|${x.symbol}` === key);
    if (!h) return;
    setSymbol(h.symbol);
    setAssetName(h.name ?? '');
    setAssetType(h.type);
    setPlatform(h.platform);
    if (h.currency) setCurrency(h.currency);
    if (h.contract) {
      setContract({
        underlying: h.contract.underlying,
        expiry: h.contract.expiry,
        strike: h.contract.strike !== undefined ? String(h.contract.strike) : '',
        optionType: h.contract.optionType ?? 'CE',
        lotSize: h.contract.lotSize ? String(h.contract.lotSize) : '',
      });
    }
    setQuantity(String(Math.abs(h.quantity)));
    touch('asset');
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

  // What's held of this symbol, here and on other platforms.
  const sym = symbol.trim().toUpperCase();
  const here = holdings.find((h) => h.symbol === sym && h.type === assetType && h.platform === platformValue);
  const elsewhere = holdings.filter((h) => h.symbol === sym && h.type === assetType && h.platform !== platformValue);
  const lotSize = Number(contract.lotSize) || undefined;
  const estimate = side === 'SELL' && here && !trade ? estimatePnl(here, qtyN, priceN, feesN, costMethod) : undefined;
  const sellable = holdings.filter((h) => h.quantity > 0);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {trade ? <input type="hidden" name="tradeId" value={trade.id} /> : null}
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="side" value={side} />
        <input type="hidden" name="occurredAt" value={isoWhen} />
        <input type="hidden" name="symbol" value={sym} />
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
              className={cn('h-7 rounded-sm text-[13px] font-medium text-ink-2', side === s && 'bg-ink text-surface')}
            >
              {s === 'BUY' ? 'Buy' : 'Sell'}
            </button>
          ))}
        </div>

        {side === 'SELL' && !trade && sellable.length ? (
          <Field label="Sell from holdings" htmlFor={`${id}-holding`}>
            <select
              id={`${id}-holding`}
              value={here ? `${here.platform}|${here.type}|${here.symbol}` : ''}
              onChange={(e) => pickHolding(e.target.value)}
              className={inputClass}
            >
              <option value="">Pick a holding…</option>
              {sellable.map((h) => (
                <option key={`${h.platform}|${h.type}|${h.symbol}`} value={`${h.platform}|${h.type}|${h.symbol}`}>
                  {h.symbol} · {fmtQty(h.quantity)} on {h.platform}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
          <Field
            label={derivative ? 'Contract' : 'Symbol'}
            htmlFor={`${id}-symbol`}
            error={err('asset') ?? err('contract')}
            hint={
              assetName
                ? `${assetName}${lastPrice ? ` · last ${fmtPrice(lastPrice.price, lastPrice.currency)}` : ''}`
                : derivative
                  ? 'Search like "NIFTY 24500 CE" or "RELIANCE FUT". Prices are NSE end-of-day.'
                  : assetType === 'mutual_fund'
                    ? 'Search an Indian fund by name for its AMFI code, or type a US fund ticker.'
                    : 'Yahoo Finance symbol. Indian stocks end in .NS or .BO.'
            }
          >
            <SymbolAutocomplete
              id={`${id}-symbol`}
              value={symbol}
              invalid={Boolean(err('asset'))}
              assetType={assetType}
              fetcher={derivative ? searchContracts : undefined}
              placeholder={derivative ? 'NIFTY 24500 CE' : undefined}
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
              onChange={(e) => {
                setAssetType(e.target.value);
                if (e.target.value === 'future' || e.target.value === 'option') setCurrency('INR');
              }}
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

        {derivative ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Underlying" htmlFor={`${id}-und`}>
              <input
                id={`${id}-und`}
                name="underlying"
                value={contract.underlying}
                onChange={(e) => setContract({ ...contract, underlying: e.target.value.toUpperCase() })}
                className={cn(inputClass, 'num uppercase')}
              />
            </Field>
            <Field label="Expiry" htmlFor={`${id}-exp`}>
              <input
                id={`${id}-exp`}
                name="expiry"
                type="date"
                value={contract.expiry}
                onChange={(e) => setContract({ ...contract, expiry: e.target.value })}
                className={cn(inputClass, 'num')}
              />
            </Field>
            {assetType === 'option' ? (
              <>
                <Field label="Strike" htmlFor={`${id}-strike`}>
                  <input
                    id={`${id}-strike`}
                    name="strike"
                    inputMode="decimal"
                    value={contract.strike}
                    onChange={(e) => setContract({ ...contract, strike: e.target.value })}
                    className={cn(inputClass, 'num text-right')}
                  />
                </Field>
                <Field label="Call / put" htmlFor={`${id}-opt`}>
                  <select
                    id={`${id}-opt`}
                    name="optionType"
                    value={contract.optionType}
                    onChange={(e) => setContract({ ...contract, optionType: e.target.value as 'CE' | 'PE' })}
                    className={inputClass}
                  >
                    <option value="CE">CE (call)</option>
                    <option value="PE">PE (put)</option>
                  </select>
                </Field>
              </>
            ) : null}
            <input type="hidden" name="lotSize" value={contract.lotSize} />
          </div>
        ) : null}

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

        {/* Holding on this platform, when selling */}
        {side === 'SELL' && sym && !trade ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-hover px-3 py-2 text-2xs">
            {here && here.quantity > 0 ? (
              <>
                <span className="num text-ink-2">
                  You hold {fmtQty(here.quantity)} on {here.platform} · avg {fmtPrice(here.avgCost, here.currency ?? currency)}
                </span>
                <span className="flex gap-1">
                  {SELL_SHARES.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setQuantity(String(+(here.quantity * s.f).toFixed(8)));
                        touch('quantity');
                      }}
                      className="rounded-sm border border-line-strong bg-surface px-1.5 py-0.5 text-ink-2 hover:text-ink"
                    >
                      {s.label}
                    </button>
                  ))}
                </span>
              </>
            ) : elsewhere.length ? (
              <span className="text-ink-2">
                Nothing on {platformValue}.{' '}
                {elsewhere.map((h) => (
                  <button key={h.platform} type="button" className="text-accent hover:underline" onClick={() => setPlatform(h.platform)}>
                    {fmtQty(h.quantity)} on {h.platform}
                  </button>
                ))}
              </span>
            ) : derivative ? (
              <span className="text-ink-2">No open position: this sell opens a short.</span>
            ) : (
              <span className="text-warn">No {sym} in your log. Add the buy first so the profit is right.</span>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label="Quantity"
            htmlFor={`${id}-qty`}
            error={err('quantity')}
            hint={derivative && lotSize && qtyN ? `${fmtQty(qtyN / lotSize)} lots of ${lotSize}` : derivative && lotSize ? `Lot size ${lotSize}` : undefined}
          >
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
              placeholder={lastPrice ? String(+lastPrice.price.toFixed(4)) : undefined}
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
          <span className="flex flex-col text-2xs text-ink-3">
            <span>
              {side === 'BUY' ? 'You pay' : 'You receive'}
              {feesN ? ` (${side === 'BUY' ? 'incl.' : 'after'} fees)` : ''}
            </span>
            {estimate !== undefined && priceN > 0 ? (
              <span>
                Profit on this sale ({costMethod === 'fifo' ? 'FIFO' : 'average cost'}){' '}
                <span className={cn('num', toneClass(estimate))}>{moneyDelta(estimate, currency)}</span>
              </span>
            ) : null}
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
