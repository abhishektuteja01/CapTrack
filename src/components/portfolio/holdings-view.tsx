import Link from 'next/link';
import type { PortfolioSnapshot } from '@/lib/portfolio';
import { moneyDelta } from '@/lib/format';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { toneClass } from '@/components/ui/num';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { HoldingsTable } from '@/components/portfolio/holdings-table';
import { StatusBar } from '@/components/portfolio/status-bar';
import { PlatformFilter } from '@/components/portfolio/platform-filter';
import { cn } from '@/lib/utils';

const GROUPS = [
  { key: undefined, label: 'No grouping' },
  { key: 'platform', label: 'Platform' },
  { key: 'currency', label: 'Currency' },
] as const;

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** The Holdings screen: every column, optional grouping, and closed positions. */
export function HoldingsView({
  snapshot,
  platform,
  group,
}: {
  snapshot: PortfolioSnapshot;
  platform?: string;
  group?: 'platform' | 'currency';
}) {
  const { baseCurrency: base, holdings, closed } = snapshot;
  const missing = [...snapshot.missingQuotes, ...snapshot.missingFx];

  const href = (g?: string) => {
    const q = new URLSearchParams();
    if (platform) q.set('platform', platform);
    if (g) q.set('group', g);
    const s = q.toString();
    return s ? `/holdings?${s}` : '/holdings';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Holdings</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PlatformFilter platforms={snapshot.platforms} current={platform} basePath="/holdings" />
          <ButtonLink href="/trades/new" size="sm" variant="primary">
            Add trade
          </ButtonLink>
        </div>
      </div>

      {missing.length ? (
        <Notice label="Partial totals">
          No price or exchange rate right now for {missing.join(', ')}. Those rows show a dash.
        </Notice>
      ) : null}

      <Panel>
        <PanelHeader
          title={`Open · ${holdings.length}`}
          meta="by value"
          actions={
            <nav aria-label="Group by" className="flex gap-0.5">
              {GROUPS.map((g) => (
                <Link
                  key={g.label}
                  href={href(g.key)}
                  aria-current={group === g.key ? 'true' : undefined}
                  className={cn(
                    'rounded-sm px-1.5 py-0.5 text-2xs text-ink-3 hover:text-ink',
                    group === g.key && 'bg-accent-soft font-medium text-accent'
                  )}
                >
                  {g.label}
                </Link>
              ))}
            </nav>
          }
        />
        {holdings.length ? (
          <HoldingsTable holdings={holdings} baseCurrency={base} variant="full" groupBy={group} />
        ) : (
          <EmptyState
            title="No open positions"
            body="Add a buy to start tracking a position."
            action={<ButtonLink href="/trades/new" variant="primary">Add trade</ButtonLink>}
          />
        )}
      </Panel>

      {closed.length ? (
        <Panel>
          <PanelHeader title={`Closed · ${closed.length}`} meta="fully sold, realized P&L" />
          <Table>
            <thead>
              <tr>
                <Th>Symbol</Th>
                <Th>Last trade</Th>
                <Th numeric>Realized ({base})</Th>
              </tr>
            </thead>
            <tbody>
              {closed.map((c) => (
                <Tr key={c.key}>
                  <Td className="font-semibold">{c.symbol}</Td>
                  <Td className="num text-ink-2">{dateLabel(c.lastTradeAt)}</Td>
                  <Td numeric className={toneClass(c.realizedBase)}>
                    {moneyDelta(c.realizedBase, base, 0)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      ) : null}

      <StatusBar snapshot={snapshot} />
    </div>
  );
}
