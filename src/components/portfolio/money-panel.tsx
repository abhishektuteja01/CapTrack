import type { ReactNode } from 'react';
import type { PortfolioSnapshot } from '@/lib/portfolio';
import { money, moneyDelta } from '@/lib/format';
import { benchmarkLabel } from '@/lib/benchmarks';
import { toneClass } from '@/components/ui/num';
import { cn } from '@/lib/utils';

function Row({ label, children, hint, strong }: { label: string; children: ReactNode; hint?: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 px-3 py-1.5', strong && 'font-medium')}>
      <dt className="text-[13px] text-ink-2" title={hint}>
        {label}
      </dt>
      <dd className="num text-[13px]">{children}</dd>
    </div>
  );
}

/**
 * Where the money went, all time, in the base currency: what went in, what came out, and what it earned.
 * Selling moves money from "invested" to "taken out", so profit never disappears from view.
 */
export function MoneyPanel({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const { money: m, totals: t, baseCurrency: c } = snapshot;
  const bench = benchmarkLabel(snapshot.settings.benchmark);
  const delta = (v: number | undefined) => <span className={toneClass(v)}>{moneyDelta(v, c, 0)}</span>;
  const ahead = t.benchmarkValue !== undefined && t.holdingsValue !== undefined ? t.holdingsValue - t.benchmarkValue : undefined;
  return (
    <dl className="flex flex-col divide-y divide-line">
      <div className="py-1">
        <Row label="Put into buys" hint="Everything paid for buys, fees included">
          {money(m.bought, c, 0)}
        </Row>
        <Row label="Taken out by sells" hint="Everything received from sells, after fees">
          {money(m.sold, c, 0)}
        </Row>
        {m.futures ? <Row label="Futures P&L settled">{delta(m.futures)}</Row> : null}
        <Row label="Net invested" strong>
          {money(m.netInvested, c, 0)}
        </Row>
      </div>
      <div className="py-1">
        <Row label="Unrealized">{delta(t.unrealized)}</Row>
        <Row label="Realized">{delta(t.realized)}</Row>
        {m.dividends ? <Row label="Dividends">{delta(m.dividends)}</Row> : null}
        {m.interest ? <Row label="Interest">{delta(m.interest)}</Row> : null}
        {m.charges ? <Row label="Charges">{delta(-m.charges)}</Row> : null}
        <Row label="Total return" strong>
          {delta(t.totalReturn)}
        </Row>
      </div>
      {m.deposits || m.withdrawals ? (
        <div className="py-1">
          <Row label="Deposited">{money(m.deposits, c, 0)}</Row>
          <Row label="Withdrawn">{money(m.withdrawals, c, 0)}</Row>
          <Row label="Cash now">{money(t.cashValue, c, 0)}</Row>
        </div>
      ) : null}
      {bench && t.benchmarkValue !== undefined ? (
        <div className="py-1">
          <Row label={`Same money in ${bench}`} hint={`Every buy bought ${bench} instead; every sell sold it`}>
            {money(t.benchmarkValue, c, 0)}
          </Row>
          <Row label={ahead !== undefined && ahead >= 0 ? 'You are ahead by' : 'You are behind by'}>{delta(ahead)}</Row>
        </div>
      ) : null}
      {m.partial ? <p className="px-3 py-2 text-2xs text-warn">Some amounts had no exchange rate and are left out.</p> : null}
    </dl>
  );
}
