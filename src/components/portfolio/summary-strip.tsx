import type { ReactNode } from 'react';
import type { PortfolioSnapshot } from '@/lib/portfolio';
import { money, moneyDelta, pct } from '@/lib/format';
import { benchmarkLabel } from '@/lib/benchmarks';
import { toneClass } from '@/components/ui/num';
import { cn } from '@/lib/utils';

function Cell({
  label,
  children,
  sub,
  big,
  className,
  title,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  big?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <div title={title} className={cn('flex min-w-0 flex-col gap-0.5 border-line bg-surface px-4 py-2.5 sm:border-r', className)}>
      <span className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">{label}</span>
      <span className={cn('num truncate', big ? 'text-[26px] font-medium leading-8 tracking-[-0.01em]' : 'text-[15px] leading-6')}>
        {children}
      </span>
      {sub ? <span className="num truncate text-2xs text-ink-3">{sub}</span> : null}
    </div>
  );
}

/**
 * One row of headline numbers, separated by hairlines. Value is the largest; today's move is the smallest.
 * Total return (everything you made, sold or not) comes before the daily change on purpose.
 */
export function SummaryStrip({ snapshot, actions }: { snapshot: PortfolioSnapshot; actions?: ReactNode }) {
  const { totals: t, baseCurrency: ccy, money: m } = snapshot;
  const bench = benchmarkLabel(snapshot.settings.benchmark);
  return (
    // Phones: a 2-column grid whose 1px gaps draw the hairlines. Wider: one row with right borders.
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:flex sm:flex-wrap sm:gap-0 sm:bg-surface">
      <Cell
        label={`Value · ${ccy}`}
        big
        className="col-span-2 max-sm:-order-3"
        sub={t.cashValue ? `incl. ${money(t.cashValue, ccy, 0)} cash` : undefined}
      >
        {money(t.value, ccy, 0)}
      </Cell>
      <Cell
        label="Net invested"
        title="Money put into buys minus money taken out by sells. Selling at a profit lowers it by the full amount."
        sub={t.costBasis !== undefined ? `holdings cost ${money(t.costBasis, ccy, 0)}` : undefined}
      >
        {money(m.netInvested, ccy, 0)}
      </Cell>
      <Cell label="Total return" className="max-sm:-order-1" title="Unrealized + realized + dividends and interest − charges" sub={t.totalReturnPct !== undefined ? `${pct(t.totalReturnPct)} on money put in` : undefined}>
        <span className={toneClass(t.totalReturn)}>{moneyDelta(t.totalReturn, ccy, 0)}</span>
      </Cell>
      <Cell label="Unrealized" sub={pct(t.unrealizedPct)}>
        <span className={toneClass(t.unrealized)}>{moneyDelta(t.unrealized, ccy, 0)}</span>
      </Cell>
      <Cell label="Realized" sub={t.income ? `+ ${money(t.income, ccy, 0)} income` : undefined}>
        <span className={toneClass(t.realized)}>{moneyDelta(t.realized, ccy, 0)}</span>
      </Cell>
      <Cell label="XIRR" sub={bench && t.benchmarkXirr !== undefined ? `${bench} ${pct(t.benchmarkXirr, 1, false)}` : 'a year'}>
        {pct(t.xirr, 2, false)}
      </Cell>
      {/* Phones: today's move sits right under Value, beside total return. */}
      <Cell label="Today" className="text-ink-2 max-sm:-order-2" sub={moneyDelta(t.dayChange, ccy, 0)}>
        <span className={cn('text-[13px] max-sm:text-[15px]', toneClass(t.dayChange))}>{pct(t.dayChangePct)}</span>
      </Cell>
      {/* Phones add from the tab bar and refresh from the page title. */}
      {actions ? <div className="hidden items-center justify-end gap-1 bg-surface px-3 py-2 md:ml-auto md:flex">{actions}</div> : null}
    </div>
  );
}
