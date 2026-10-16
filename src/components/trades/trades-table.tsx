'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import type { ActivityRow } from '@/lib/trades';
import { deleteEntriesAction } from '@/app/(app)/trades/actions';
import { money, price, qty } from '@/lib/format';
import { Table, Td, Th } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PanelHeader } from '@/components/ui/panel';
import { CASH_KIND_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

const subscribe = () => () => {};

/** YYYY-MM-DD in the viewer's zone (UTC during server render, so hydration matches). */
function dayKey(iso: string, local: boolean) {
  if (!local) return iso.slice(0, 10);
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const dayParts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** "Tue, 13 Oct 2026", joined by hand so server and browser ICU versions render the same text. */
const dayLabel = (date: Date) => {
  const p = Object.fromEntries(dayParts.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
};
/** "13 Oct 2026", for the phone list where the date sits in each row. */
const shortDay = (date: Date) => dayLabel(date).slice(5);

const label = (r: ActivityRow) => (r.entry === 'trade' ? (r.kind === 'BUY' ? 'Buy' : 'Sell') : CASH_KIND_LABELS[r.kind as keyof typeof CASH_KIND_LABELS]);
const outflow = (r: ActivityRow) => r.kind === 'BUY' || r.kind === 'withdrawal' || r.kind === 'fee';

/**
 * Trades and cash entries grouped under day headers in the viewer's time zone.
 * Each row opens its edit panel; checkboxes select rows for deleting together.
 */
export function ActivityTable({
  rows,
  editHrefs,
  header,
}: {
  rows: ActivityRow[];
  editHrefs: Record<string, string>;
  /** The panel header, so phones can put Select in it. */
  header: { title: string; meta: string; actions: ReactNode };
}) {
  const local = useSyncExternalStore(subscribe, () => true, () => false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  // Phones show checkboxes only after "Select", so a tap normally opens the entry.
  const [selecting, setSelecting] = useState(false);
  const [deleting, start] = useTransition();
  const router = useRouter();

  function remove() {
    start(async () => {
      const res = await deleteEntriesAction(Array.from(selected));
      setFailed(!res.ok);
      if (res.ok) {
        setSelected(new Set());
        setConfirm(false);
      }
      router.refresh();
    });
  }
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
    <div>
      <PanelHeader
        {...header}
        actions={
          <>
            {header.actions}
            <Button
              size="sm"
              variant="ghost"
              className="sm:hidden"
              onClick={() => {
                if (selecting) setSelected(new Set());
                setSelecting(!selecting);
              }}
            >
              {selecting ? 'Done' : 'Select'}
            </Button>
          </>
        }
      />
      {selected.size ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-hover px-3 py-1.5 text-2xs">
          <span className="text-ink-2">{selected.size} selected</span>
          {confirm ? (
            <span className="flex items-center gap-1">
              <span className="text-ink-2">Delete {selected.size}? Positions will be recalculated.</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
              <Button size="sm" variant="danger" onClick={remove} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
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
          {failed ? <span className="text-neg">Couldn&apos;t delete. Try again.</span> : null}
        </div>
      ) : null}
      <div className="sm:hidden">
        <ul className="divide-y divide-line">
          {rows.map((t) => {
            const k = `${t.entry}:${t.id}`;
            const row = cn('flex min-h-14 items-center gap-3 px-3 py-2', selected.has(k) && 'bg-accent-soft/50');
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.symbol ?? label(t)}</span>
                  <span className="block truncate text-2xs text-ink-3">
                    {[
                      t.symbol ? label(t) : undefined,
                      t.quantity !== null && t.price !== null ? `${qty(t.quantity)} × ${price(t.price, t.currency)}` : undefined,
                      t.platform,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn('num block', t.entry === 'cash' && !outflow(t) && 'text-pos')}>
                    {t.entry === 'cash' ? (outflow(t) ? '−' : '+') : ''}
                    {money(t.amount, t.currency)}
                  </span>
                  <span className="num block text-2xs text-ink-3">{shortDay(new Date(`${dayKey(t.occurredAt, local)}T00:00:00Z`))}</span>
                </span>
              </>
            );
            return (
              <li key={k}>
                {selecting ? (
                  <label className={row}>
                    <input type="checkbox" checked={selected.has(k)} onChange={() => toggle(k)} className="accent-accent" />
                    {body}
                  </label>
                ) : (
                  <Link href={editHrefs[k]} scroll={false} className={cn(row, 'active:bg-hover')}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="hidden sm:block">
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
      </div>
    </div>
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
          {dayLabel(new Date(`${day}T00:00:00Z`))}
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
