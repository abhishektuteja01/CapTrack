'use client';

import { useActionState, useId, useState } from 'react';
import { deleteCashAction, saveCashAction, type TradeActionState } from '@/app/(app)/trades/actions';
import type { EditableCash, OpenAccount } from '@/lib/trades';
import type { CashKind } from '@/lib/domain/portfolio/money';
import { money } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { inputClass } from './symbol-autocomplete';
import { Field, toLocalInput, useIsClient } from './trade-form';

export const CASH_KIND_LABELS: Record<CashKind, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  dividend: 'Dividend',
  interest: 'Interest',
  fee: 'Charge',
};

const HINTS: Record<CashKind, string> = {
  deposit: 'Money added to the platform. Logging deposits turns on a cash balance for it.',
  withdrawal: 'Money taken out of the platform to your bank.',
  dividend: 'What reached your account, after any tax withheld.',
  interest: 'Interest paid on cash or bonds.',
  fee: 'Charges not tied to a trade: account fees, DP charges, platform fees.',
};

export type CashPrefill = Partial<{
  kind: CashKind;
  symbol: string;
  assetType: string;
  platform: string;
  amount: number;
  currency: string;
  date: string;
}>;

/** Add or edit a deposit, withdrawal, dividend, interest payment or charge. */
export default function CashForm({
  entry,
  prefill,
  holdings = [],
  platforms,
  baseCurrency,
  returnTo,
  onCancel,
}: {
  entry?: EditableCash;
  prefill?: CashPrefill;
  holdings?: OpenAccount[];
  platforms: string[];
  baseCurrency: string;
  returnTo: string;
  onCancel?: () => void;
}) {
  const [state, formAction, saving] = useActionState<TradeActionState | undefined, FormData>(saveCashAction, undefined);
  const id = useId();
  const isClient = useIsClient();

  const [kind, setKind] = useState<CashKind>(entry?.kind ?? prefill?.kind ?? 'deposit');
  const [platform, setPlatform] = useState(entry?.platform ?? prefill?.platform ?? platforms[0] ?? 'Manual');
  const [symbol, setSymbol] = useState(entry?.assetSymbol ?? prefill?.symbol ?? '');
  const [assetType, setAssetType] = useState(entry?.assetType ?? prefill?.assetType ?? '');
  const [amount, setAmount] = useState(entry ? String(entry.amount) : prefill?.amount ? String(+prefill.amount.toFixed(2)) : '');
  const [currency, setCurrency] = useState(entry?.currency ?? prefill?.currency ?? baseCurrency);
  const [when, setWhen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const start = entry?.occurredAt ?? (prefill?.date ? `${prefill.date}T12:00:00` : new Date().toISOString());
  const localWhen = when ?? (isClient ? toLocalInput(start) : '');
  const isoWhen = localWhen ? new Date(localWhen).toISOString() : '';
  const err = (name: string) => (state && !state.ok ? state.fieldErrors?.[name] : undefined);
  const withSymbol = kind === 'dividend' || kind === 'interest';
  const platformOptions = platforms.includes(platform) ? platforms : [...platforms, platform];
  const held = Array.from(new Map(holdings.filter((h) => h.quantity > 0).map((h) => [`${h.type}|${h.symbol}`, h])).values());

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {entry ? <input type="hidden" name="cashId" value={entry.id} /> : null}
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="occurredAt" value={isoWhen} />
        <input type="hidden" name="assetType" value={assetType} />

        <div role="radiogroup" aria-label="Kind" className="grid grid-cols-5 rounded-md border border-line-strong p-0.5">
          {(Object.keys(CASH_KIND_LABELS) as CashKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn('h-7 rounded-sm text-[12px] font-medium text-ink-2', kind === k && 'bg-ink text-surface')}
            >
              {CASH_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="-mt-2 text-2xs text-ink-3">{HINTS[kind]}</p>

        {withSymbol ? (
          <Field label={kind === 'dividend' ? 'Paid by' : 'From (optional)'} htmlFor={`${id}-sym`} error={err('assetSymbol')}>
            <input
              id={`${id}-sym`}
              name="assetSymbol"
              list={`${id}-held`}
              value={symbol}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                setSymbol(v);
                const h = held.find((x) => x.symbol === v);
                setAssetType(h?.type ?? '');
                if (h?.currency) setCurrency(h.currency);
                if (h && !entry) setPlatform(h.platform);
              }}
              placeholder="Symbol, e.g. ITC.NS"
              className={cn(inputClass, 'num uppercase placeholder:normal-case')}
            />
            <datalist id={`${id}-held`}>
              {held.map((h) => (
                <option key={`${h.type}|${h.symbol}`} value={h.symbol}>
                  {h.name ?? h.symbol}
                </option>
              ))}
            </datalist>
          </Field>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor={`${id}-when`} error={err('occurredAt')}>
            {isClient ? (
              <input
                id={`${id}-when`}
                type="datetime-local"
                value={localWhen}
                onChange={(e) => setWhen(e.target.value)}
                className={cn(inputClass, 'num')}
              />
            ) : (
              <div className={cn(inputClass, 'bg-subtle')} />
            )}
          </Field>
          <Field label="Platform" htmlFor={`${id}-platform`} error={err('platform')}>
            <select id={`${id}-platform`} name="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass}>
              {platformOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
          <Field label="Amount" htmlFor={`${id}-amount`} error={err('amount')}>
            <input
              id={`${id}-amount`}
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(err('amount')) || undefined}
              className={cn(inputClass, 'num text-right')}
            />
          </Field>
          <Field label="Currency" htmlFor={`${id}-ccy`} error={err('currency')}>
            <input
              id={`${id}-ccy`}
              name="currency"
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              className={cn(inputClass, 'num uppercase')}
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor={`${id}-notes`}>
          <textarea id={`${id}-notes`} name="notes" defaultValue={entry?.notes ?? ''} rows={2} maxLength={500} className={cn(inputClass, 'h-auto py-1.5')} />
        </Field>

        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <span className="text-2xs text-ink-3">{kind === 'withdrawal' || kind === 'fee' ? 'Leaves the account' : 'Into the account'}</span>
          <span className="num text-[15px] font-medium">{/^[A-Z]{3}$/.test(currency) ? money(Number(amount) || 0, currency) : '—'}</span>
        </div>

        {state && !state.ok ? (
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
            {saving ? 'Saving…' : entry ? 'Save changes' : `Add ${CASH_KIND_LABELS[kind].toLowerCase()}`}
          </Button>
        </div>
      </form>

      {entry ? (
        <form action={deleteCashAction} className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <input type="hidden" name="cashId" value={entry.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {confirmDelete ? (
            <>
              <span className="text-2xs text-ink-2">Delete this entry?</span>
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
              Delete entry
            </Button>
          )}
        </form>
      ) : null}
    </div>
  );
}
