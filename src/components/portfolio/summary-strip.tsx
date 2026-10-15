import type { ReactNode } from 'react';
import type { PortfolioSnapshot } from '@/lib/portfolio';
import { money, moneyDelta, pct } from '@/lib/format';
import { toneClass } from '@/components/ui/num';
import { cn } from '@/lib/utils';

function Cell({
  label,
  children,
  sub,
  big,
  className,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  big?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 border-line px-4 py-2.5', className)}>
      <span className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">{label}</span>
      <span className={cn('num truncate', big ? 'text-[26px] font-medium leading-8 tracking-[-0.01em]' : 'text-[15px] leading-6')}>
        {children}
      </span>
      {sub ? <span className="num text-2xs text-ink-3">{sub}</span> : null}
    </div>
  );
}

/**
 * One row of headline numbers, separated by hairlines. Value is the largest; today's move is the smallest.
 * Long-term return comes before the daily change on purpose.
 */
export function SummaryStrip({ snapshot, actions }: { snapshot: PortfolioSnapshot; actions?: ReactNode }) {
  const { totals: t, baseCurrency: ccy } = snapshot;
  return (
    <div className="flex flex-wrap items-stretch rounded-md border border-line bg-surface [&>*]:border-r [&>*:last-child]:border-r-0">
      <Cell label={`Portfolio value · ${ccy}`} big className="basis-full border-b !border-r-0 sm:basis-auto sm:border-b-0 sm:!border-r">
        {money(t.value, ccy, 0)}
      </Cell>
      <Cell label="Invested">{money(t.costBasis, ccy, 0)}</Cell>
      <Cell label="Unrealized" sub={pct(t.unrealizedPct)}>
        <span className={toneClass(t.unrealized)}>{moneyDelta(t.unrealized, ccy, 0)}</span>
      </Cell>
      <Cell label="Realized">
        <span className={toneClass(t.realized)}>{moneyDelta(t.realized, ccy, 0)}</span>
      </Cell>
      <Cell label="XIRR" sub="a year">
        {pct(t.xirr, 2, false)}
      </Cell>
      <Cell label="Today" className="text-ink-2" sub={moneyDelta(t.dayChange, ccy, 0)}>
        <span className={cn('text-[13px]', toneClass(t.dayChange))}>{pct(t.dayChangePct)}</span>
      </Cell>
      {actions ? <div className="ml-auto flex items-center gap-2 px-3 py-2">{actions}</div> : null}
    </div>
  );
}
