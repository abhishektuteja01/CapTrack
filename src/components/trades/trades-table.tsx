'use client';

import Link from 'next/link';
import type { TradeListRow } from '@/lib/trades';
import { money, price, qty } from '@/lib/format';
import { Table, Td, Th } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** YYYY-MM-DD in the viewer's zone (UTC during server render, so hydration matches). */
function dayKey(iso: string, local: boolean) {
  if (!local) return iso.slice(0, 10);
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * Trade log grouped under day headers in the viewer's time zone. Each row opens the edit panel.
 */
export function TradesTable({ rows, editHrefs }: { rows: TradeListRow[]; editHrefs: Record<string, string> }) {
  const local = useSyncExternalStore(subscribe, () => true, () => false);
  const editHref = (id: string) => editHrefs[id];
  const groups: { day: string; rows: TradeListRow[] }[] = [];
  for (const r of rows) {
    const day = dayKey(r.occurredAt, local);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.rows.push(r);
    else groups.push({ day, rows: [r] });
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Symbol</Th>
          <Th>Side</Th>
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
          <DayRows key={g.day} day={g.day} rows={g.rows} editHref={editHref} />
        ))}
      </tbody>
    </Table>
  );
}

function DayRows({ day, rows, editHref }: { day: string; rows: TradeListRow[]; editHref: (id: string) => string }) {
  return (
    <>
      <tr>
        <td colSpan={8} className="num border-b border-line bg-subtle/60 px-3 py-1 text-2xs font-medium text-ink-2">
          {dayFmt.format(new Date(`${day}T00:00:00Z`))}
        </td>
      </tr>
      {rows.map((t) => {
        const amount = t.quantity * t.price + (t.side === 'BUY' ? t.fees : -t.fees);
        const href = editHref(t.id);
        return (
          <tr key={t.id} className="group cursor-pointer hover:bg-hover">
            <Td className="max-w-56">
              <Link href={href} scroll={false} className="block outline-none focus-visible:underline">
                <span className="font-semibold">{t.symbol}</span>
                {t.assetName ? <span className="ml-2 hidden truncate text-2xs text-ink-3 sm:inline">{t.assetName}</span> : null}
              </Link>
            </Td>
            <Td>
              <span className={cn('text-2xs font-medium uppercase tracking-[0.04em]', t.side === 'BUY' ? 'text-ink' : 'text-ink-2')}>
                {t.side === 'BUY' ? 'Buy' : 'Sell'}
              </span>
            </Td>
            <Td numeric>{qty(t.quantity)}</Td>
            <Td numeric wide>{price(t.price, t.currency)}</Td>
            <Td numeric wide className="text-ink-3">{t.fees ? money(t.fees, t.currency) : '—'}</Td>
            <Td numeric>{money(amount, t.currency)}</Td>
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
