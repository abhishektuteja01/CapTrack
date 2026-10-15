import type { ReactNode } from 'react';
import Link from 'next/link';
import { chartPoints, type PortfolioSnapshot } from '@/lib/portfolio';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { SummaryStrip } from '@/components/portfolio/summary-strip';
import { PerformanceChart } from '@/components/portfolio/performance-chart';
import { AllocationPanel } from '@/components/portfolio/allocation-panel';
import { HoldingsTable } from '@/components/portfolio/holdings-table';
import { StatusBar } from '@/components/portfolio/status-bar';
import { PlatformFilter } from '@/components/portfolio/platform-filter';

/** The Overview screen. Used by the dashboard and, with example data, by the landing page. */
export function OverviewView({
  snapshot,
  platform,
  refresh,
  setup,
}: {
  snapshot: PortfolioSnapshot;
  platform?: string;
  refresh?: ReactNode;
  /** First-run setup form, shown when there are no trades at all. */
  setup?: ReactNode;
}) {
  const { baseCurrency, holdings } = snapshot;
  const missing = [...snapshot.missingQuotes, ...snapshot.missingFx];

  const actions = (
    <>
      {refresh}
      <ButtonLink href="/trades/new?from=/dashboard" size="sm" variant="primary">
        Add trade
      </ButtonLink>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Overview</h1>
        {snapshot.tradeCount > 0 || platform ? <PlatformFilter platforms={snapshot.platforms} current={platform} /> : null}
      </div>

      {snapshot.tradeCount === 0 && !platform ? (
        <Panel>
          <PanelHeader title="Set up" meta="two questions, then your first trade" />
          {setup ?? (
            <EmptyState
              title="No trades yet"
              action={
                <ButtonLink href="/trades?new=1" variant="primary">
                  Add your first trade
                </ButtonLink>
              }
            />
          )}
        </Panel>
      ) : snapshot.tradeCount === 0 ? (
        <Panel>
          <EmptyState title={`No trades on ${platform} yet`} />
        </Panel>
      ) : (
        <>
          <SummaryStrip snapshot={snapshot} actions={actions} />

          {missing.length ? (
            <Notice label="Partial totals">
              {missing.join(', ')} {missing.length === 1 ? 'is' : 'are'} left out of value and returns because a
              price or exchange rate is unavailable right now.
            </Notice>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader title="Value vs invested" meta={baseCurrency} />
              {snapshot.history.length > 1 ? (
                <PerformanceChart points={chartPoints(snapshot.history)} currency={baseCurrency} />
              ) : (
                <p className="px-3 py-10 text-[13px] text-ink-3">The chart starts after your first full day of holding.</p>
              )}
            </Panel>
            <Panel>
              <PanelHeader title="Allocation" />
              <AllocationPanel allocation={snapshot.allocation} currency={baseCurrency} />
            </Panel>
          </div>

          <Panel>
            <PanelHeader
              title={`Holdings · ${holdings.length}`}
              meta="by value"
              actions={
                <Link href="/holdings" className="px-1 text-2xs text-accent hover:underline">
                  All columns
                </Link>
              }
            />
            {holdings.length ? (
              <HoldingsTable holdings={holdings} baseCurrency={baseCurrency} />
            ) : (
              <EmptyState
                title="No open positions"
                body="Everything has been sold. Realized P&L stays in your totals; closed positions are listed on the Holdings page."
              />
            )}
          </Panel>

          <StatusBar snapshot={snapshot} />
        </>
      )}
    </div>
  );
}
