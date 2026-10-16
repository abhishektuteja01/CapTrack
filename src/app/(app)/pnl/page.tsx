import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { loadPortfolio } from '@/lib/portfolio';
import { taxYearLabel, taxYearOf, yearSummaries } from '@/lib/domain/portfolio/tax';
import { makeFxLookup } from '@/lib/domain/fx/rates';
import { tradeDate } from '@/lib/domain/portfolio/positions';
import { isoDate } from '@/lib/services/market/store';
import { holdingHref, sheetHref } from '@/lib/sheet-links';
import { money, moneyDelta, qty } from '@/lib/format';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { toneClass } from '@/components/ui/num';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { EntrySheets } from '@/components/entries/entry-sheets';
import { ShowMore } from '@/components/ui/show-more';
import { CASH_KIND_LABELS } from '@/lib/labels';
import { cn, touch } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'P&L' };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const day = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

function Stat({ label, value, base, strong }: { label: string; value: number; base: string; strong?: boolean }) {
  return (
    // Net spans the phone grid's two columns, so the other six pair up evenly.
    <div className={cn('flex min-w-0 flex-col gap-0.5 bg-surface px-4 py-2.5', strong && 'max-sm:col-span-2')}>
      <span className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">{label}</span>
      <span className={cn('num truncate', strong ? 'text-[20px] font-medium' : 'text-[15px]', toneClass(value))}>{moneyDelta(value, base, 0)}</span>
    </div>
  );
}

/** Realized gains, income and charges per tax year, every sale with its holding period, and unlogged dividends. */
export default async function PnlPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await supabaseServer();
  const { snapshot, sales, suggestions, input } = await loadPortfolio(supabase, undefined, false);
  const { baseCurrency: base, settings } = snapshot;
  const fy = settings.fyStartMonth;
  const fx = makeFxLookup(input.fxRows);

  const cash = input.cash.map((c) => {
    const rate = fx(c.currency, base, tradeDate(c));
    return { ...c, amountBase: rate === undefined ? undefined : c.amount * rate };
  });
  const years = yearSummaries({ sales, cash, startMonth: fy });
  const current = taxYearOf(isoDate(), fy);
  const yearParam = first(sp.year);
  const year = yearParam === 'all' ? undefined : Number(yearParam) || years[0]?.year || current;
  const inYear = (iso: string) => year === undefined || taxYearOf(new Date(iso).toISOString().slice(0, 10), fy) === year;

  const rows = sales.filter((r) => inYear(r.closedAt));
  const income = cash.filter((c) => c.kind !== 'deposit' && c.kind !== 'withdrawal' && inYear(c.occurredAt));
  const shown = year === undefined
    ? years.reduce(
        (a, y) => ({ ...a, shortTerm: a.shortTerm + y.shortTerm, longTerm: a.longTerm + y.longTerm, derivatives: a.derivatives + y.derivatives, dividends: a.dividends + y.dividends, interest: a.interest + y.interest, charges: a.charges + y.charges, partial: a.partial || y.partial }),
        { shortTerm: 0, longTerm: 0, derivatives: 0, dividends: 0, interest: 0, charges: 0, partial: false }
      )
    : years.find((y) => y.year === year) ?? { shortTerm: 0, longTerm: 0, derivatives: 0, dividends: 0, interest: 0, charges: 0, partial: false };
  const net = shown.shortTerm + shown.longTerm + shown.derivatives + shown.dividends + shown.interest + shown.charges;
  const here = new URLSearchParams(yearParam ? { year: yearParam } : {});
  const yearLinks = Array.from(new Set([current, ...years.map((y) => y.year)])).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Profit and loss</h1>
        <nav aria-label="Tax year" className="flex max-w-full gap-0.5 overflow-x-auto rounded-md border border-line bg-surface p-0.5">
          {yearLinks.map((y) => (
            <Link
              key={y}
              href={`/pnl?year=${y}`}
              aria-current={year === y ? 'true' : undefined}
              className={cn('whitespace-nowrap rounded-sm px-2 py-0.5 text-2xs text-ink-2 hover:text-ink', touch, year === y && 'bg-accent-soft font-medium text-accent')}
            >
              {taxYearLabel(y, fy)}
            </Link>
          ))}
          <Link
            href="/pnl?year=all"
            aria-current={year === undefined ? 'true' : undefined}
            className={cn('whitespace-nowrap rounded-sm px-2 py-0.5 text-2xs text-ink-2 hover:text-ink', touch, year === undefined && 'bg-accent-soft font-medium text-accent')}
          >
            All years
          </Link>
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Net" value={net} base={base} strong />
        <Stat label="Short-term gains" value={shown.shortTerm} base={base} />
        <Stat label={`Long-term (> ${settings.longTermMonths} mo)`} value={shown.longTerm} base={base} />
        <Stat label="Futures & options" value={shown.derivatives} base={base} />
        <Stat label="Dividends" value={shown.dividends} base={base} />
        <Stat label="Interest" value={shown.interest} base={base} />
        <Stat label="Charges" value={shown.charges} base={base} />
      </div>
      {shown.partial ? <p className="text-2xs text-warn">Some amounts had no exchange rate and are left out.</p> : null}

      <Panel>
        <PanelHeader
          title={`Sales · ${rows.length}`}
          meta={`${settings.costMethod === 'fifo' ? 'FIFO' : 'average cost'}, amounts in ${base} at each date's rate`}
          actions={
            rows.length && year !== undefined ? (
              <ButtonLink href={`/api/export?what=sales&year=${year}`} size="sm" variant="ghost" prefetch={false}>
                Export CSV
              </ButtonLink>
            ) : null
          }
        />
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Sold</Th>
                <Th>Symbol</Th>
                <Th numeric>Qty</Th>
                <Th wide>Bought</Th>
                <Th wide>Term</Th>
                <Th numeric wide>Cost</Th>
                <Th numeric wide>Proceeds</Th>
                <Th numeric>P&amp;L</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.key}>
                  <Td className="num text-ink-2">{day(r.closedAt)}</Td>
                  <Td>
                    <Link href={holdingHref(r)} className="font-semibold hover:underline">
                      {r.symbol}
                    </Link>
                    <span className="ml-1.5 text-2xs text-ink-3">
                      {r.platform}
                      {r.direction === 'short' ? ' · short' : ''}
                      {r.settled ? ' · expiry' : ''}
                    </span>
                  </Td>
                  <Td numeric>{qty(r.quantity)}</Td>
                  <Td wide className="num text-2xs text-ink-2">
                    {day(r.firstOpenedAt)}
                    {r.lastOpenedAt.slice(0, 10) !== r.firstOpenedAt.slice(0, 10) ? ` – ${day(r.lastOpenedAt)}` : ''}
                  </Td>
                  <Td wide className="text-2xs uppercase tracking-[0.04em] text-ink-2">{r.term}</Td>
                  <Td numeric wide className="text-ink-2">{money(r.costBase, base, 0)}</Td>
                  <Td numeric wide className="text-ink-2">{money(r.proceedsBase, base, 0)}</Td>
                  <Td numeric className={toneClass(r.pnlBase)}>{moneyDelta(r.pnlBase, base, 0)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No sales in this period" body="Sells and expired contracts show up here with what they cost, what they brought in and how long they were held." />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title={`Income and charges · ${income.length}`}
          actions={
            <ButtonLink href={sheetHref('/pnl', here, { cash: 'new', kind: 'dividend' })} scroll={false} size="sm" variant="ghost">
              Add dividend
            </ButtonLink>
          }
        />
        {income.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Kind</Th>
                <Th>From</Th>
                <Th wide>Platform</Th>
                <Th numeric>Amount</Th>
                <Th numeric wide>{base}</Th>
              </tr>
            </thead>
            <tbody>
              {[...income].reverse().map((c) => (
                <Tr key={c.id}>
                  <Td className="num text-ink-2">
                    <Link href={sheetHref('/pnl', here, { cash: c.id })} scroll={false} className="hover:underline">
                      {day(c.occurredAt)}
                    </Link>
                  </Td>
                  <Td className="text-2xs uppercase tracking-[0.04em]">{CASH_KIND_LABELS[c.kind]}</Td>
                  <Td className="font-semibold">{c.assetSymbol ?? '—'}</Td>
                  <Td wide className="text-ink-2">{c.platform}</Td>
                  <Td numeric className={c.kind === 'fee' ? undefined : 'text-pos'}>
                    {c.kind === 'fee' ? '−' : '+'}
                    {money(c.amount, c.currency)}
                  </Td>
                  <Td numeric wide className="text-ink-2">{money(c.amountBase, base, 0)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No dividends, interest or charges logged in this period" />
        )}
      </Panel>

      <Panel>
        <div id="dividends" className="scroll-mt-4" />
        <PanelHeader title={`Dividends not logged · ${suggestions.length}`} meta="from reported dividends and what you held the day before" />
        {suggestions.length ? (
          <ShowMore count={suggestions.length}>
            <Table>
              <thead>
                <tr>
                  <Th>Ex-date</Th>
                  <Th>Symbol</Th>
                  <Th wide>Platform</Th>
                  <Th numeric wide>Held</Th>
                  <Th numeric wide>Per share</Th>
                  <Th numeric>Expected</Th>
                  <Th className="w-14" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {suggestions.map((d) => (
                  <Tr key={`${d.assetKey}|${d.platform}|${d.exDate}`}>
                    <Td className="num text-ink-2">{day(`${d.exDate}T00:00:00Z`)}</Td>
                    <Td className="font-semibold">{d.symbol}</Td>
                    <Td wide className="text-ink-2">{d.platform}</Td>
                    <Td numeric wide>{qty(d.quantity)}</Td>
                    <Td numeric wide className="text-ink-2">{money(d.perShare, d.currency)}</Td>
                    <Td numeric>{money(d.amount, d.currency)}</Td>
                    <Td className="text-right">
                      <Link
                        href={sheetHref('/pnl', here, { cash: 'new', kind: 'dividend', symbol: d.symbol, type: d.type, platform: d.platform, amount: d.amount.toFixed(2), currency: d.currency, date: d.exDate })}
                        scroll={false}
                        className={cn('rounded-sm border border-line-strong px-1.5 py-0.5 text-2xs text-ink-2 hover:bg-subtle hover:text-ink', touch)}
                      >
                        Add
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </ShowMore>
        ) : (
          <p className="px-3 py-4 text-[13px] text-ink-3">Every reported dividend for what you held is logged.</p>
        )}
        <p className="border-t border-line px-3 py-2 text-2xs text-ink-3">
          Amounts are before tax withheld. Log what actually reached your account.
        </p>
      </Panel>

      <p className="px-0.5 text-2xs text-ink-3">
        Not tax advice: no rates, exemptions or grandfathering, just the grouping a return starts from. Change the tax year, long-term threshold and cost method in{' '}
        <Link href="/settings" className="text-accent hover:underline">
          Settings
        </Link>
        .
      </p>

      <EntrySheets basePath="/pnl" searchParams={sp} />
    </div>
  );
}
