import type { ReactNode } from 'react';
import Link from 'next/link';
import { chartPoints, type PortfolioSnapshot } from '@/lib/portfolio';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SummaryStrip } from '@/components/portfolio/summary-strip';
import { PerformanceChart } from '@/components/portfolio/performance-chart';
import { AllocationPanel } from '@/components/portfolio/allocation-panel';
import { HoldingsTable } from '@/components/portfolio/holdings-table';
import { StatusBar } from '@/components/portfolio/status-bar';
import { PlatformFilter } from '@/components/portfolio/platform-filter';
import { MoneyPanel } from '@/components/portfolio/money-panel';
import { PortfolioNotices } from '@/components/portfolio/notices';
import { benchmarkLabel } from '@/lib/benchmarks';
import { sheetHref } from '@/lib/sheet-links';
import { cn, touch } from '@/lib/utils';

/** The Overview screen. Used by the dashboard and, with example data, by the landing page. */
export function OverviewView({
  snapshot,
  platform,
  refresh,
  setup,
  demo,
}: {
  snapshot: PortfolioSnapshot;
  platform?: string;
  refresh?: ReactNode;
  /** First-run setup form, shown when there are no trades at all. */
  setup?: ReactNode;
  /** Example data on the landing page: no links into the app, no page title. */
  demo?: boolean;
}) {
  const { baseCurrency, holdings } = snapshot;
  const here = new URLSearchParams(platform ? { platform } : {});
  const hereHref = platform ? `/dashboard?${here}` : '/dashboard';

  const actions = demo ? undefined : (
    <>
      {refresh}
      <ButtonLink href={sheetHref('/dashboard', here, { trade: 'new' })} scroll={false} size="sm" variant="primary">
        Add trade
      </ButtonLink>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className={demo ? 'hidden' : 'flex flex-wrap items-center justify-between gap-2'}>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Overview</h1>
          {snapshot.tradeCount + snapshot.cashCount > 0 ? <div className="md:hidden">{refresh}</div> : null}
        </div>
        {snapshot.tradeCount > 0 || platform ? <PlatformFilter platforms={snapshot.platforms} current={platform} /> : null}
      </div>

      {snapshot.tradeCount + snapshot.cashCount === 0 && !platform ? (
        <Panel>
          <PanelHeader title="Set up" meta="two questions, then your first trade" />
          {setup ?? (
            <EmptyState
              title="No trades yet"
              action={
                <ButtonLink href={sheetHref('/dashboard', here, { trade: 'new' })} scroll={false} variant="primary">
                  Add your first trade
                </ButtonLink>
              }
            />
          )}
        </Panel>
      ) : snapshot.tradeCount + snapshot.cashCount === 0 ? (
        <Panel>
          <EmptyState title={`No trades on ${platform} yet`} />
        </Panel>
      ) : (
        <>
          <SummaryStrip snapshot={snapshot} actions={actions} />

          {demo ? null : <PortfolioNotices snapshot={snapshot} />}

          {/* Phones: the two grids dissolve so the panels can reorder: chart, holdings, allocation, money. */}
          <div className="grid gap-3 max-md:contents lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <Panel className="max-md:order-1">
              <PanelHeader title="Value vs net invested" meta={baseCurrency} />
              {snapshot.history.length > 1 ? (
                <PerformanceChart
                  points={chartPoints(snapshot.history)}
                  currency={baseCurrency}
                  benchmarkLabel={benchmarkLabel(snapshot.settings.benchmark)}
                />
              ) : (
                <p className="px-3 py-10 text-[13px] text-ink-3">The chart starts after your first full day of holding.</p>
              )}
            </Panel>
            <Panel className="max-md:order-3">
              <PanelHeader title="Allocation" />
              <AllocationPanel allocation={snapshot.allocation} currency={baseCurrency} />
            </Panel>
          </div>

          <div className="grid gap-3 max-md:contents lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <Panel className="max-md:order-2">
              <PanelHeader
                title={`Holdings · ${holdings.length}`}
                meta="by value"
                actions={
                  demo ? undefined : (
                    <Link href="/holdings" className={cn('px-1 text-2xs text-accent hover:underline', touch)}>
                      <span className="max-sm:hidden">All columns</span>
                      <span className="sm:hidden">See all</span>
                    </Link>
                  )
                }
              />
              {holdings.length ? (
                <HoldingsTable holdings={holdings} baseCurrency={baseCurrency} interactive={!demo} here={hereHref} />
              ) : (
                <EmptyState
                  title="No open positions"
                  body="Everything has been sold. Realized P&L stays in your totals; closed positions are listed on the Holdings page."
                />
              )}
            </Panel>
            <Panel className="max-md:order-4">
              <PanelHeader title="Money in and out" meta="all time" />
              <MoneyPanel snapshot={snapshot} />
            </Panel>
          </div>

          <div className="max-md:order-5">
            <StatusBar snapshot={snapshot} />
          </div>
        </>
      )}
    </div>
  );
}
