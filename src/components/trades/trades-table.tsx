'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import type { ActivityRow } from '@/lib/trades';
import { deleteEntriesAction } from '@/app/(app)/trades/actions';
import { money, price, qty } from '@/lib/format';
import { Table, Td, Th } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CASH_KIND_LABELS } from './cash-form';
import { cn } from '@/lib/utils';

const subscribe = () => () => {};

/** YYYY-MM-DD in the viewer's zone (UTC during server render, so hydration matches). */
function dayKey(iso: string, local: boolean) {
  if (!local) return iso.slice(0, 10);
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const label = (r: ActivityRow) => (r.entry === 'trade' ? (r.kind === 'BUY' ? 'Buy' : 'Sell') : CASH_KIND_LABELS[r.kind as keyof typeof CASH_KIND_LABELS]);
const outflow = (r: ActivityRow) => r.kind === 'BUY' || r.kind === 'withdrawal' || r.kind === 'fee';

/**
 * Trades and cash entries grouped under day headers in the viewer's time zone.
 * Each row opens its edit panel; checkboxes select rows for deleting together.
 */
export function ActivityTable({ rows, editHrefs, returnTo }: { rows: ActivityRow[]; editHrefs: Record<string, string>; returnTo: string }) {
  const local = useSyncExternalStore(subscribe, () => true, () => false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const groups: { day: string; rows: ActivityRow[] }[] = [];
  for (const r of rows) {
    const day = dayKey(r.occurredAt, local);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.rows.push(r);
    else groups.push({ day, rows: [r] });
  }
  const toggle = (k: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const allKeys = rows.map((r) => `${r.entry}:${r.id}`);

  return (
    <form action={deleteEntriesAction}>
      <input type="hidden" name="returnTo" value={returnTo} />
      {Array.from(selected).map((k) => (
        <input key={k} type="hidden" name="ids" value={k} />
      ))}
      {selected.size ? (
        <div className="flex items-center justify-between gap-2 border-b border-line bg-hover px-3 py-1.5 text-2xs">
          <span className="text-ink-2">{selected.size} selected</span>
          {confirm ? (
            <span className="flex items-center gap-1">
              <span className="text-ink-2">Delete {selected.size}? Positions will be recalculated.</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
              <Button size="sm" variant="danger" type="submit">
                Delete
              </Button>
            </span>
          ) : (
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button size="sm" variant="ghost" className="text-neg" onClick={() => setConfirm(true)}>
                Delete selected
              </Button>
            </span>
          )}
        </div>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th className="w-8 pr-0">
              <input
                type="checkbox"
                aria-label="Select all on this page"
                checked={selected.size === allKeys.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(allKeys) : new Set())}
                className="accent-accent"
              />
            </Th>
            <Th>Symbol</Th>
            <Th>Kind</Th>
            <Th numeric>Qty</Th>
            <Th numeric wide>Price</Th>
            <Th numeric wide>Fees</Th>
            <Th numeric>Amount</Th>
            <Th wide>Platform</Th>
            <Th wide>Notes</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <DayRows key={g.day} day={g.day} rows={g.rows} editHrefs={editHrefs} selected={selected} toggle={toggle} />
          ))}
        </tbody>
      </Table>
    </form>
  );
}

function DayRows({
  day,
  rows,
  editHrefs,
  selected,
  toggle,
}: {
  day: string;
  rows: ActivityRow[];
  editHrefs: Record<string, string>;
  selected: Set<string>;
  toggle: (k: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={9} className="num border-b border-line bg-subtle/60 px-3 py-1 text-2xs font-medium text-ink-2">
          {dayFmt.format(new Date(`${day}T00:00:00Z`))}
        </td>
      </tr>
      {rows.map((t) => {
        const k = `${t.entry}:${t.id}`;
        const href = editHrefs[k];
        return (
          <tr key={k} className={cn('group hover:bg-hover', selected.has(k) && 'bg-accent-soft/50')}>
            <Td className="w-8 pr-0">
              <input type="checkbox" aria-label={`Select ${label(t)} ${t.symbol ?? ''}`} checked={selected.has(k)} onChange={() => toggle(k)} className="accent-accent" />
            </Td>
            <Td className="max-w-56">
              <Link href={href} scroll={false} className="block outline-none focus-visible:underline">
                <span className="font-semibold">{t.symbol ?? '—'}</span>
                {t.assetName ? <span className="ml-2 hidden truncate text-2xs text-ink-3 sm:inline">{t.assetName}</span> : null}
              </Link>
            </Td>
            <Td>
              <Link href={href} scroll={false} className={cn('text-2xs font-medium uppercase tracking-[0.04em]', t.kind === 'BUY' ? 'text-ink' : 'text-ink-2')}>
                {label(t)}
              </Link>
            </Td>
            <Td numeric>{t.quantity !== null ? qty(t.quantity) : ''}</Td>
            <Td numeric wide>{t.price !== null ? price(t.price, t.currency) : ''}</Td>
            <Td numeric wide className="text-ink-3">{t.fees ? money(t.fees, t.currency) : t.entry === 'trade' ? '—' : ''}</Td>
            <Td numeric className={t.entry === 'cash' && !outflow(t) ? 'text-pos' : undefined}>
              {t.entry === 'cash' ? (outflow(t) ? '−' : '+') : ''}
              {money(t.amount, t.currency)}
            </Td>
            <Td wide className="text-ink-2">{t.platform}</Td>
            <Td wide className="max-w-48 truncate text-2xs text-ink-3" title={t.notes ?? undefined}>
              {t.notes ?? ''}
            </Td>
          </tr>
        );
      })}
    </>
  );
}
