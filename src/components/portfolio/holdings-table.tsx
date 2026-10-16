'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Holding } from '@/lib/portfolio';
import { money, moneyDelta, pct, price, qty } from '@/lib/format';
import { holdingHref, sheetHref } from '@/lib/sheet-links';
import { toneClass } from '@/components/ui/num';
import { Sparkline } from '@/components/ui/sparkline';
import { Table, Td, Th } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Variant = 'overview' | 'full';

function Missing({ h }: { h: Holding }) {
  if (!h.missing) return null;
  return (
    <span className="ml-1.5 rounded-sm bg-warn-soft px-1 py-px text-2xs text-warn">
      {h.missing === 'quote' ? 'No price' : 'No FX rate'}
    </span>
  );
}

function SplitTag({ h }: { h: Holding }) {
  if (!h.splits.length) return null;
  const label = h.splits
    .map((s) => (s.ratio >= 1 ? `${+s.ratio.toFixed(2)}:1` : `1:${+(1 / s.ratio).toFixed(2)}`))
    .join(', ');
  const title = h.splits
    .map((s) => `Quantity and cost adjusted for a ${s.ratio >= 1 ? 'split' : 'reverse split'} on ${s.date}${s.source === 'detected' ? ' (detected from the price change)' : ''}`)
    .join('. ');
  return (
    <span title={title} className="ml-1.5 rounded-sm bg-subtle px-1 py-px text-2xs text-ink-2">
      split {label}
    </span>
  );
}

type SortKey = 'symbol' | 'quantity' | 'day' | 'value' | 'weight' | 'unrealized' | 'unrealizedPct' | 'realized';

const SORTS: Record<SortKey, (h: Holding) => number | string | undefined> = {
  symbol: (h) => h.symbol,
  quantity: (h) => h.quantity,
  day: (h) => h.dayChangePct,
  value: (h) => h.valueBase,
  weight: (h) => h.weight,
  unrealized: (h) => h.unrealizedBase,
  unrealizedPct: (h) => h.unrealizedPct,
  realized: (h) => h.realizedBase,
};

function sorted(rows: Holding[], key: SortKey, dir: 1 | -1) {
  const f = SORTS[key];
  return [...rows].sort((a, b) => {
    const x = f(a);
    const y = f(b);
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return (typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number)) * dir;
  });
}

function sum(rows: Holding[], f: (h: Holding) => number | undefined) {
  return rows.reduce((s, h) => s + (f(h) ?? 0), 0);
}

/**
 * Holdings, sorted by value until a header is clicked. Color only on change columns.
 * `full` adds platform, currency, intraday sparkline and realized P&L, grouping with subtotals,
 * and a Sell button per row. `interactive` rows open the holding's page.
 */
export function HoldingsTable({
  holdings,
  baseCurrency: base,
  variant = 'overview',
  groupBy,
  interactive = true,
  here = '/holdings',
}: {
  holdings: Holding[];
  baseCurrency: string;
  variant?: Variant;
  groupBy?: 'platform' | 'currency';
  interactive?: boolean;
  /** Current page URL, so the Sell panel opens over it. */
  here?: string;
}) {
  const full = variant === 'full';
  const cols = full ? 14 : 9;
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [pathname, query = ''] = here.split('?');
  const params = new URLSearchParams(query);
  const router = useRouter();

  const groups: { key: string; rows: Holding[] }[] = [];
  if (groupBy) {
    const map = new Map<string, Holding[]>();
    for (const h of holdings) {
      const k = groupBy === 'platform' ? h.platforms.join(', ') : h.quoteCurrency ?? h.tradeCurrency ?? '—';
      map.set(k, [...(map.get(k) ?? []), h]);
    }
    for (const [key, rows] of map) groups.push({ key, rows });
    groups.sort((a, b) => sum(b.rows, (h) => h.valueBase) - sum(a.rows, (h) => h.valueBase));
  } else {
    groups.push({ key: '', rows: holdings });
  }
  if (sort) for (const g of groups) g.rows = sorted(g.rows, sort.key, sort.dir);

  const head = (key: SortKey, label: string, props: { numeric?: boolean; wide?: boolean; className?: string } = {}) => (
    <Th {...props} aria-sort={sort?.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => setSort((s) => (s?.key === key ? { key, dir: s.dir > 0 ? -1 : 1 } : { key, dir: key === 'symbol' ? 1 : -1 }))}
        className={cn('uppercase hover:text-ink', sort?.key === key && 'text-ink')}
      >
        {label}
        {sort?.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
      </button>
    </Th>
  );

  const sellHref = (h: Holding) => {
    const a = [...h.accounts].sort((x, y) => y.quantity - x.quantity)[0];
    return sheetHref(pathname, params, { trade: 'new', side: 'SELL', symbol: h.symbol, type: h.type, platform: a?.platform, qty: a?.quantity });
  };

  return (
    <Table>
      <thead>
        <tr>
          {head('symbol', 'Symbol')}
          {full ? (
            <>
              <Th wide>Platform</Th>
              <Th wide>Ccy</Th>
            </>
          ) : null}
          {head('quantity', 'Qty', { numeric: true, wide: !full })}
          <Th numeric wide>Avg cost</Th>
          <Th numeric wide>Price</Th>
          {full ? <Th wide className="px-1">Intraday</Th> : null}
          {head('day', 'Day', { numeric: true, wide: true })}
          {head('value', `Value ${base}`, { numeric: true })}
          {head('weight', 'Weight', { numeric: true, wide: true })}
          {head('unrealized', 'Unrealized', { numeric: true, wide: true })}
          {head('unrealizedPct', '%', { numeric: true })}
          {full ? head('realized', 'Realized', { numeric: true, wide: true }) : null}
          {full && interactive ? <Th className="w-14" aria-label="Actions" /> : null}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <GroupRows key={g.key || 'all'} group={g} base={base} cols={cols} grouped={Boolean(groupBy)}>
            {g.rows.map((h) => (
              <tr
                key={`${g.key}:${h.key}`}
                className={cn('hover:bg-hover', interactive && 'cursor-pointer')}
                onClick={interactive ? (e) => !(e.target as HTMLElement).closest('a,button') && router.push(holdingHref(h)) : undefined}
              >
                <Td className="max-w-56">
                  <div className="flex items-center">
                    {interactive ? (
                      <Link href={holdingHref(h)} className="font-semibold outline-none focus-visible:underline">
                        {h.symbol}
                      </Link>
                    ) : (
                      <span className="font-semibold">{h.symbol}</span>
                    )}
                    <SplitTag h={h} />
                    <Missing h={h} />
                  </div>
                  {full && h.name ? <div className="truncate text-2xs text-ink-3">{h.name}</div> : null}
                </Td>
                {full ? (
                  <>
                    <Td wide className="text-ink-2">{h.platforms.join(', ')}</Td>
                    <Td wide className="num text-ink-2">{h.quoteCurrency ?? h.tradeCurrency}</Td>
                  </>
                ) : null}
                <Td numeric wide={!full}>{qty(h.quantity)}</Td>
                <Td numeric wide className="text-ink-2">{price(h.avgCost, h.tradeCurrency ?? base)}</Td>
                <Td numeric wide title={h.priceSource === 'nav' ? `NAV of ${h.priceDate}` : h.priceSource === 'trade' ? 'Last trade price' : undefined}>
                  {price(h.price, h.quoteCurrency ?? base)}
                  {h.priceSource === 'nav' || h.priceSource === 'trade' ? <span className="ml-1 text-2xs text-ink-3">{h.priceSource === 'nav' ? 'NAV' : 'last'}</span> : null}
                </Td>
                {full ? (
                  <Td wide className="px-1">
                    <Sparkline values={h.intraday} reference={h.previousClose} />
                  </Td>
                ) : null}
                <Td numeric wide className={toneClass(h.dayChangePct)}>{pct(h.dayChangePct)}</Td>
                <Td numeric>{money(h.valueBase, base, 0)}</Td>
                <Td numeric wide className="text-ink-2">{h.weight !== undefined ? `${h.weight.toFixed(1)}%` : '—'}</Td>
                <Td numeric wide className={toneClass(h.unrealizedBase)}>{moneyDelta(h.unrealizedBase, base, 0)}</Td>
                <Td numeric className={toneClass(h.unrealizedPct)}>{pct(h.unrealizedPct)}</Td>
                {full ? (
                  <Td numeric wide className={toneClass(h.realizedBase)}>
                    {h.realizedBase ? moneyDelta(h.realizedBase, base, 0) : '—'}
                  </Td>
                ) : null}
                {full && interactive ? (
                  <Td className="text-right">
                    <Link
                      href={sellHref(h)}
                      scroll={false}
                      className="rounded-sm border border-line-strong px-1.5 py-0.5 text-2xs text-ink-2 hover:bg-subtle hover:text-ink"
                    >
                      Sell
                    </Link>
                  </Td>
                ) : null}
              </tr>
            ))}
          </GroupRows>
        ))}
      </tbody>
    </Table>
  );
}

function GroupRows({
  group,
  base,
  cols,
  grouped,
  children,
}: {
  group: { key: string; rows: Holding[] };
  base: string;
  cols: number;
  grouped: boolean;
  children: React.ReactNode;
}) {
  const value = sum(group.rows, (h) => h.valueBase);
  const unrealized = sum(group.rows, (h) => h.unrealizedBase);
  return (
    <>
      {grouped ? (
        <tr className="bg-subtle/60">
          <td colSpan={cols} className="border-b border-line px-3 py-1">
            <div className="flex items-baseline justify-between gap-4 text-2xs">
              <span className="font-semibold text-ink">{group.key}</span>
              <span className="num text-ink-2">
                {money(value, base, 0)} value
                <span className="mx-1.5 text-line-strong">·</span>
                <span className={toneClass(unrealized)}>{moneyDelta(unrealized, base, 0)}</span> unrealized
              </span>
            </div>
          </td>
        </tr>
      ) : null}
      {children}
    </>
  );
}
