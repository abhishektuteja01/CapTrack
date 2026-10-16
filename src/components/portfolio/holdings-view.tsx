import Link from 'next/link';
import type { Holding, PortfolioSnapshot } from '@/lib/portfolio';
import { money, moneyDelta, pct, price, qty } from '@/lib/format';
import { holdingHref, sheetHref } from '@/lib/sheet-links';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { toneClass } from '@/components/ui/num';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { HoldingsTable } from '@/components/portfolio/holdings-table';
import { StatusBar } from '@/components/portfolio/status-bar';
import { PlatformFilter } from '@/components/portfolio/platform-filter';
import { PortfolioNotices } from '@/components/portfolio/notices';
import { cn } from '@/lib/utils';

const GROUPS = [
  { key: undefined, label: 'No grouping' },
  { key: 'platform', label: 'Platform' },
  { key: 'currency', label: 'Currency' },
] as const;

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

function daysTo(date: string, today = new Date().toISOString().slice(0, 10)) {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
}

/** Open futures and options: direction, lots, entry and mark, open P&L, days to expiry. */
export function DerivativesTable({ rows, base, here }: { rows: Holding[]; base: string; here: string }) {
  const [path, query = ''] = here.split('?');
  return (
    <Table>
      <thead>
        <tr>
          <Th>Contract</Th>
          <Th>Side</Th>
          <Th numeric>Qty</Th>
          <Th numeric wide>Avg</Th>
          <Th numeric>Mark</Th>
          <Th numeric>P&amp;L {base}</Th>
          <Th numeric wide>Expiry</Th>
          <Th className="w-16" aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {rows.map((h) => {
          const lot = h.contract?.lotSize;
          const left = h.contract ? daysTo(h.contract.expiry) : undefined;
          const close = sheetHref(path, new URLSearchParams(query), {
            trade: 'new',
            side: h.quantity > 0 ? 'SELL' : 'BUY',
            symbol: h.symbol,
            type: h.type,
            platform: h.accounts[0]?.platform,
            qty: Math.abs(h.quantity),
          });
          return (
            <Tr key={h.key}>
              <Td className="max-w-64">
                <Link href={holdingHref(h)} className="font-semibold hover:underline">
                  {h.symbol}
                </Link>
                {h.unsettled ? <span className="ml-1.5 rounded-sm bg-warn-soft px-1 py-px text-2xs text-warn">Awaiting settlement</span> : null}
                <div className="text-2xs text-ink-3">{h.platforms.join(', ')}</div>
              </Td>
              <Td className="text-2xs font-medium uppercase tracking-[0.04em]">{h.quantity > 0 ? 'Long' : 'Short'}</Td>
              <Td numeric>
                {qty(Math.abs(h.quantity))}
                {lot ? <div className="text-2xs text-ink-3">{qty(Math.abs(h.quantity) / lot)} lots</div> : null}
              </Td>
              <Td numeric wide className="text-ink-2">{price(Math.abs(h.avgCost), h.tradeCurrency ?? base)}</Td>
              <Td numeric title={h.priceSource === 'eod' ? `NSE settlement price of ${h.priceDate}` : 'Last trade price'}>
                {price(h.price, h.quoteCurrency ?? base)}
                <div className="text-2xs text-ink-3">{h.priceSource === 'eod' ? h.priceDate : 'last trade'}</div>
              </Td>
              <Td numeric className={toneClass(h.unrealizedBase)}>
                {moneyDelta(h.unrealizedBase, base, 0)}
                <div className="text-2xs">{pct(h.unrealizedPct)}</div>
              </Td>
              <Td numeric wide className={cn('text-ink-2', left !== undefined && left <= 3 && left >= 0 && 'text-warn')}>
                {h.contract ? dateLabel(h.contract.expiry) : '—'}
                {left !== undefined ? <div className="text-2xs text-ink-3">{left > 0 ? `${left}d left` : left === 0 ? 'today' : 'expired'}</div> : null}
              </Td>
              <Td className="text-right">
                <Link href={close} scroll={false} className="rounded-sm border border-line-strong px-1.5 py-0.5 text-2xs text-ink-2 hover:bg-subtle hover:text-ink">
                  Close
                </Link>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** The Holdings screen: every column, optional grouping, F&O, cash and closed positions. */
export function HoldingsView({
  snapshot,
  platform,
  group,
}: {
  snapshot: PortfolioSnapshot;
  platform?: string;
  group?: 'platform' | 'currency';
}) {
  const { baseCurrency: base, holdings, derivatives, closed, cash } = snapshot;

  const params = new URLSearchParams();
  if (platform) params.set('platform', platform);
  if (group) params.set('group', group);
  const here = params.size ? `/holdings?${params}` : '/holdings';
  const href = (g?: string) => {
    const q = new URLSearchParams();
    if (platform) q.set('platform', platform);
    if (g) q.set('group', g);
    return q.size ? `/holdings?${q}` : '/holdings';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Holdings</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PlatformFilter platforms={snapshot.platforms} current={platform} basePath="/holdings" />
          <ButtonLink href={sheetHref('/holdings', params, { trade: 'new' })} scroll={false} size="sm" variant="primary">
            Add trade
          </ButtonLink>
        </div>
      </div>

      <PortfolioNotices snapshot={snapshot} />

      <Panel>
        <PanelHeader
          title={`Open · ${holdings.length}`}
          meta="click a column to sort"
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
          <HoldingsTable holdings={holdings} baseCurrency={base} variant="full" groupBy={group} here={here} />
        ) : (
          <EmptyState
            title="No open positions"
            body="Add a buy, or import your broker's tradebook."
            action={
              <span className="flex gap-2">
                <ButtonLink href={sheetHref('/holdings', params, { trade: 'new' })} scroll={false} variant="primary">
                  Add trade
                </ButtonLink>
                <ButtonLink href="/trades/import">Import a CSV</ButtonLink>
              </span>
            }
          />
        )}
      </Panel>

      {derivatives.length ? (
        <Panel>
          <PanelHeader title={`Futures & options · ${derivatives.length}`} meta="NSE settlement prices, end of day" />
          <DerivativesTable rows={derivatives} base={base} here={here} />
        </Panel>
      ) : null}

      {cash.length ? (
        <Panel>
          <PanelHeader title="Cash" meta="deposits − withdrawals ± trades and income, per platform" />
          <Table>
            <thead>
              <tr>
                <Th>Platform</Th>
                <Th>Currency</Th>
                <Th numeric>Balance</Th>
                <Th numeric>{base}</Th>
              </tr>
            </thead>
            <tbody>
              {cash.map((c) => (
                <Tr key={`${c.platform}|${c.currency}`}>
                  <Td>{c.platform}</Td>
                  <Td className="num text-ink-2">{c.currency}</Td>
                  <Td numeric className={c.amount < 0 ? 'text-neg' : undefined}>{money(c.amount, c.currency)}</Td>
                  <Td numeric>{money(c.valueBase, base, 0)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {cash.some((c) => c.amount < 0) ? (
            <p className="px-3 py-2 text-2xs text-ink-3">A negative balance usually means a deposit isn&apos;t logged yet.</p>
          ) : null}
        </Panel>
      ) : null}

      {closed.length ? (
        <Panel>
          <PanelHeader title={`Closed · ${closed.length}`} meta="fully sold" />
          <Table>
            <thead>
              <tr>
                <Th>Symbol</Th>
                <Th wide>Held</Th>
                <Th numeric wide>Put in</Th>
                <Th numeric wide>Taken out</Th>
                <Th numeric>Realized</Th>
                <Th numeric wide>Income</Th>
                <Th numeric>Return</Th>
              </tr>
            </thead>
            <tbody>
              {closed.map((c) => (
                <Tr key={c.key}>
                  <Td>
                    <Link href={holdingHref(c)} className="font-semibold hover:underline">
                      {c.symbol}
                    </Link>
                    <div className="text-2xs text-ink-3">{c.platforms.join(', ')}</div>
                  </Td>
                  <Td wide className="num text-2xs text-ink-2">
                    {dateLabel(c.firstTradeAt)} – {dateLabel(c.lastTradeAt)}
                  </Td>
                  <Td numeric wide className="text-ink-2">{money(c.boughtBase, base, 0)}</Td>
                  <Td numeric wide className="text-ink-2">{money(c.soldBase, base, 0)}</Td>
                  <Td numeric className={toneClass(c.realizedBase)}>{moneyDelta(c.realizedBase, base, 0)}</Td>
                  <Td numeric wide className={toneClass(c.incomeBase)}>{c.incomeBase ? moneyDelta(c.incomeBase, base, 0) : '—'}</Td>
                  <Td numeric className={toneClass(c.returnPct)}>{pct(c.returnPct)}</Td>
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
