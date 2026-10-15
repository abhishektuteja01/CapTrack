import type { Holding } from '@/lib/portfolio';
import { money, moneyDelta, pct, price, qty } from '@/lib/format';
import { toneClass } from '@/components/ui/num';
import { Sparkline } from '@/components/ui/sparkline';
import { Table, Td, Th, Tr } from '@/components/ui/table';

type Variant = 'overview' | 'full';

function Missing({ h }: { h: Holding }) {
  if (!h.missing) return null;
  return (
    <span className="ml-1.5 rounded-sm bg-warn-soft px-1 py-px text-2xs text-warn">
      {h.missing === 'quote' ? 'No price' : 'No FX rate'}
    </span>
  );
}

function Row({ h, base, variant }: { h: Holding; base: string; variant: Variant }) {
  const full = variant === 'full';
  return (
    <Tr>
      <Td className="max-w-56">
        <div className="flex items-center">
          <span className="font-semibold">{h.symbol}</span>
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
      <Td numeric wide>{price(h.price, h.quoteCurrency ?? base)}</Td>
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
    </Tr>
  );
}

function sum(rows: Holding[], f: (h: Holding) => number | undefined) {
  return rows.reduce((s, h) => s + (f(h) ?? 0), 0);
}

/**
 * Holdings sorted by value. Color only on change columns.
 * `full` adds platform, currency, intraday sparkline and realized P&L, and supports grouping with subtotals.
 */
export function HoldingsTable({
  holdings,
  baseCurrency: base,
  variant = 'overview',
  groupBy,
}: {
  holdings: Holding[];
  baseCurrency: string;
  variant?: Variant;
  groupBy?: 'platform' | 'currency';
}) {
  const full = variant === 'full';
  const cols = full ? 13 : 9;

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

  return (
    <Table>
      <thead>
        <tr>
          <Th>Symbol</Th>
          {full ? (
            <>
              <Th wide>Platform</Th>
              <Th wide>Ccy</Th>
            </>
          ) : null}
          <Th numeric wide={!full}>Qty</Th>
          <Th numeric wide>Avg cost</Th>
          <Th numeric wide>LTP</Th>
          {full ? <Th wide className="px-1">Intraday</Th> : null}
          <Th numeric wide>Day</Th>
          <Th numeric>Value {base}</Th>
          <Th numeric wide>Weight</Th>
          <Th numeric wide>Unrealized</Th>
          <Th numeric>%</Th>
          {full ? <Th numeric wide>Realized</Th> : null}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <GroupRows key={g.key || 'all'} group={g} base={base} variant={variant} cols={cols} grouped={Boolean(groupBy)} />
        ))}
      </tbody>
    </Table>
  );
}

function GroupRows({
  group,
  base,
  variant,
  cols,
  grouped,
}: {
  group: { key: string; rows: Holding[] };
  base: string;
  variant: Variant;
  cols: number;
  grouped: boolean;
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
      {group.rows.map((h) => (
        <Row key={`${group.key}:${h.key}`} h={h} base={base} variant={variant} />
      ))}
    </>
  );
}
