'use client';

import { useActionState, useState } from 'react';
import {
  deleteAllAction,
  saveReturnsAction,
  saveBaseCurrencyAction,
  saveNameAction,
  savePlatformsAction,
  saveSetupAction,
  type SettingsState,
} from '@/app/(app)/settings/actions';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/trades/symbol-autocomplete';
import { CurrencyPicker } from './currency-picker';
import { cn } from '@/lib/utils';
import { BENCHMARKS } from '@/lib/benchmarks';
import type { PortfolioSettings } from '@/lib/portfolio';

function Status({ state }: { state: SettingsState }) {
  if (!state) return null;
  return (
    <p role="status" className={cn('text-2xs', state.ok ? 'text-pos' : 'text-neg')}>
      {state.message}
    </p>
  );
}

export function BaseCurrencyForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(saveBaseCurrencyAction, undefined);
  const [value, setValue] = useState(current);
  return (
    <form action={action} className="flex flex-col gap-2 p-4">
      <label htmlFor="base-ccy" className="text-[13px] text-ink-2">
        Every total, return and chart is shown in this currency. Each trade keeps its own currency and converts at the
        rate on its date.
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <CurrencyPicker id="base-ccy" name="baseCurrency" value={value} onChange={setValue} />
        <Button type="submit" size="sm" variant="secondary" disabled={pending || value === current}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <Status state={state} />
    </form>
  );
}

type Item = { id: number; original: string | null; name: string };

/** Add, rename and remove platforms. Renames carry over to existing trades. */
export function PlatformsEditor({ current }: { current: string[] }) {
  const [state, action, pending] = useActionState(savePlatformsAction, undefined);
  const [items, setItems] = useState<Item[]>(current.map((name, i) => ({ id: i, original: name, name })));
  const [draft, setDraft] = useState('');
  const [nextId, setNextId] = useState(current.length);

  const names = items.map((i) => i.name.trim()).filter(Boolean);
  const renames = items
    .filter((i) => i.original && i.name.trim() && i.name.trim() !== i.original)
    .map((i) => ({ from: i.original!, to: i.name.trim() }));
  const dirty = JSON.stringify(names) !== JSON.stringify(current);

  function add() {
    const name = draft.trim();
    if (!name || names.some((n) => n.toLowerCase() === name.toLowerCase())) return;
    setItems([...items, { id: nextId, original: null, name }]);
    setNextId(nextId + 1);
    setDraft('');
  }

  return (
    <form action={action} className="flex flex-col gap-2 p-4">
      <input type="hidden" name="platforms" value={JSON.stringify(names)} />
      <input type="hidden" name="renames" value={JSON.stringify(renames)} />
      <p className="text-[13px] text-ink-2">
        Brokers and apps you trade on. Renaming one updates its trades. Removing one keeps its trades.
      </p>
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 px-2 py-1">
            <input
              aria-label={`Platform name${it.original ? ` (was ${it.original})` : ''}`}
              value={it.name}
              maxLength={64}
              onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
              className={cn(inputClass, 'h-7 border-transparent hover:border-line focus:border-accent')}
            />
            {it.original && it.name.trim() && it.name.trim() !== it.original ? (
              <span className="shrink-0 text-2xs text-ink-3">was {it.original}</span>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${it.name}`}
              onClick={() => setItems(items.filter((x) => x.id !== it.id))}
              disabled={items.length === 1}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          aria-label="New platform"
          placeholder="Add a platform"
          value={draft}
          maxLength={64}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className={cn(inputClass, 'h-7 max-w-64')}
        />
        <Button size="sm" variant="secondary" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
        <Button type="submit" size="sm" variant="primary" className="ml-auto" disabled={pending || (!dirty && !renames.length)}>
          {pending ? 'Saving…' : 'Save platforms'}
        </Button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function NameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(saveNameAction, undefined);
  const [value, setValue] = useState(current);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        id="display-name"
        name="name"
        value={value}
        maxLength={80}
        onChange={(e) => setValue(e.target.value)}
        className={cn(inputClass, 'h-7 max-w-64')}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending || value.trim() === current}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
      <Status state={state} />
    </form>
  );
}

const COMMON_PLATFORMS = ['Zerodha', 'Groww', 'Upstox', 'Interactive Brokers', 'Vested', 'INDmoney', 'Robinhood', 'Fidelity', 'Coinbase'];

/** Shown on an empty Overview: pick a base currency and platforms, then go straight to the first trade. */
export function SetupForm({ baseCurrency, platforms }: { baseCurrency: string; platforms: string[] }) {
  const [state, action, pending] = useActionState(saveSetupAction, undefined);
  const [ccy, setCcy] = useState(baseCurrency);
  const [chosen, setChosen] = useState<string[]>(platforms.filter((p) => p !== 'Manual'));
  const [draft, setDraft] = useState('');
  const toggle = (p: string) => setChosen(chosen.includes(p) ? chosen.filter((x) => x !== p) : [...chosen, p]);
  const options = Array.from(new Set([...COMMON_PLATFORMS, ...chosen]));

  return (
    <form action={action} className="flex flex-col gap-4 p-4">
      <input type="hidden" name="platforms" value={JSON.stringify(chosen.length ? chosen : ['Manual'])} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="setup-ccy" className="text-[13px] font-medium">
          Which currency should totals be in?
        </label>
        <CurrencyPicker id="setup-ccy" name="baseCurrency" value={ccy} onChange={setCcy} />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-medium">Where do you trade?</legend>
        <div className="flex flex-wrap gap-1.5">
          {options.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={chosen.includes(p)}
              onClick={() => toggle(p)}
              className={cn(
                'rounded-md border px-2 py-1 text-[13px]',
                chosen.includes(p) ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-ink-2 hover:bg-hover'
              )}
            >
              {p}
            </button>
          ))}
          <input
            aria-label="Other platform"
            placeholder="Other…"
            value={draft}
            maxLength={64}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                e.preventDefault();
                if (!chosen.includes(draft.trim())) setChosen([...chosen, draft.trim()]);
                setDraft('');
              }
            }}
            className={cn(inputClass, 'h-[30px] w-32')}
          />
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Continue to first trade'}
        </Button>
        <span className="text-2xs text-ink-3">You can change both later in Settings.</span>
      </div>
      <Status state={state} />
    </form>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Row({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-4">
      <label htmlFor={htmlFor} className="pt-1.5 text-[13px] text-ink-2">
        {label}
      </label>
      <div className="flex flex-col gap-1">
        {children}
        {hint ? <p className="text-2xs text-ink-3">{hint}</p> : null}
      </div>
    </div>
  );
}

/** How profit is counted and grouped, and what to compare against. */
export function ReturnsForm({ current }: { current: PortfolioSettings }) {
  const [state, action, pending] = useActionState(saveReturnsAction, undefined);
  const known = BENCHMARKS.some((b) => b.symbol === current.benchmark);
  const [bench, setBench] = useState(current.benchmark ? (known ? current.benchmark : '__custom__') : '');
  return (
    <form action={action} className="flex flex-col gap-3 p-4">
      <Row label="Cost method" htmlFor="cost-method" hint="FIFO sells your oldest units first, as Indian and US tax rules do. Average cost pools every buy.">
        <select id="cost-method" name="costMethod" defaultValue={current.costMethod} className={cn(inputClass, 'max-w-64')}>
          <option value="fifo">First in, first out (FIFO)</option>
          <option value="average">Average cost</option>
        </select>
      </Row>
      <Row label="Tax year starts in" htmlFor="fy-start" hint="April for India, January for the US. Groups the P&L page.">
        <select id="fy-start" name="fyStartMonth" defaultValue={current.fyStartMonth} className={cn(inputClass, 'max-w-64')}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Long-term after" htmlFor="long-term" hint="Months held before a sale counts as long-term. 12 for Indian equity and US stocks; 24 for most other Indian assets.">
        <span className="flex items-center gap-2">
          <input id="long-term" name="longTermMonths" type="number" min={1} max={60} defaultValue={current.longTermMonths} className={cn(inputClass, 'num w-20 text-right')} />
          <span className="text-[13px] text-ink-2">months</span>
        </span>
      </Row>
      <Row label="Benchmark" htmlFor="benchmark" hint="Shown on the chart and next to XIRR: what the same buys and sells would have done in this index.">
        <span className="flex flex-wrap items-center gap-2">
          <select id="benchmark" name="benchmark" value={bench} onChange={(e) => setBench(e.target.value)} className={cn(inputClass, 'max-w-64')}>
            <option value="">None</option>
            {BENCHMARKS.map((b) => (
              <option key={b.symbol} value={b.symbol}>
                {b.label}
              </option>
            ))}
            <option value="__custom__">Other Yahoo symbol…</option>
          </select>
          {bench === '__custom__' ? (
            <input
              aria-label="Benchmark symbol"
              name="customBenchmark"
              defaultValue={known ? '' : current.benchmark ?? ''}
              placeholder="e.g. VWRA.L"
              className={cn(inputClass, 'num w-40 uppercase')}
            />
          ) : null}
        </span>
      </Row>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** Delete every trade and cash entry, after typing "delete". */
export function DeleteAllForm() {
  const [state, action, pending] = useActionState(deleteAllAction, undefined);
  const [text, setText] = useState('');
  return (
    <form action={action} className="flex flex-col gap-2 p-4">
      <p className="text-[13px] text-ink-2">Removes every trade and cash entry. Settings and platforms stay. Export first if you might want them back.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Type delete to confirm"
          name="confirm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type delete"
          className={cn(inputClass, 'h-7 w-40')}
        />
        <Button type="submit" size="sm" variant="danger" disabled={pending || text.trim().toLowerCase() !== 'delete'}>
          {pending ? 'Deleting…' : 'Delete all activity'}
        </Button>
      </div>
      <Status state={state} />
    </form>
  );
}
