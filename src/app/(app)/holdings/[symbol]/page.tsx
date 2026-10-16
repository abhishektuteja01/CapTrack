import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { loadPortfolio } from '@/lib/portfolio';
import { assetKey, tradeDate } from '@/lib/domain/portfolio/positions';
import { makeFxLookup } from '@/lib/domain/fx/rates';
import { xirr } from '@/lib/domain/portfolio/xirr';
import { termOf, daysHeld } from '@/lib/domain/portfolio/tax';
import { contractLabel } from '@/lib/domain/portfolio/contracts';
import { isoDate } from '@/lib/services/market/store';
import { sheetHref } from '@/lib/sheet-links';
import { money, moneyDelta, pct, price, qty } from '@/lib/format';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { toneClass } from '@/components/ui/num';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { PriceChart } from '@/components/portfolio/price-chart';
import { EntrySheets } from '@/components/entries/entry-sheets';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Params = Promise<{ symbol: string }>;
type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const day = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: decodeURIComponent((await params).symbol) };
}

function Stat({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 bg-surface px-4 py-2.5">
      <span className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">{label}</span>
      <span className="num truncate text-[15px] leading-6">{children}</span>
      {sub ? <span className="num truncate text-2xs text-ink-3">{sub}</span> : null}
    </div>
  );
}

/** One holding: price with your trades marked, open lots, every trade, realized sales and dividends. */
export default async function HoldingPage({ params, searchParams }: { params: Params; searchParams?: Promise<SearchParams> }) {
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  const sp = searchParams ? await searchParams : {};
  const supabase = await supabaseServer();
  const model = await loadPortfolio(supabase, undefined, false);
  const { snapshot, input } = model;
  const base = snapshot.baseCurrency;

  const type = first(sp.type) ?? input.trades.find((t) => t.asset.symbol.toUpperCase() === symbol)?.asset.type;
  if (!type) notFound();
  const key = assetKey(symbol, type);
  const trades = input.trades.filter((t) => assetKey(t.asset.symbol, t.asset.type) === key);
  if (!trades.length) notFound();

  const h = [...snapshot.holdings, ...snapshot.derivatives].find((x) => x.key === key);
  const closed = snapshot.closed.find((x) => x.key === key);
  const fx = makeFxLookup(input.fxRows);
  const today = isoDate();
  const name = h?.name ?? trades.find((t) => t.name)?.name;
  const currency = h?.quoteCurrency ?? h?.tradeCurrency ?? trades[0].currency ?? base;
  const contract = trades.find((t) => t.contract)?.contract ?? undefined;

  // Lots still open, per platform, valued at today's price.
  const positions = model.replay.positions.filter((p) => p.assetKey === key && !p.closed);
  const rateNow = h?.price !== undefined && h.quoteCurrency ? fx(h.quoteCurrency, base, today) : undefined;
  const lots = positions
    .flatMap((p) => p.lots.map((l) => ({ ...l, platform: p.platform })))
    .sort((a, b) => (a.openedAt < b.openedAt ? -1 : 1));

  const sales = model.sales.filter((r) => assetKey(r.symbol, r.type) === key);
  const dividends = input.cash.filter((c) => c.kind === 'dividend' && c.assetSymbol?.toUpperCase() === symbol);
  const suggestions = model.suggestions.filter((s) => s.assetKey === key);
  const income = h?.incomeBase ?? closed?.incomeBase ?? 0;
  const realized = h?.realizedBase ?? closed?.realizedBase;
  const unrealized = h?.unrealizedBase;
  const totalReturn = realized !== undefined ? realized + (unrealized ?? 0) + income : undefined;

  // XIRR for this holding: its trades and dividends, plus what it's worth today.
  const ids = new Set(trades.map((t) => t.id));
  const flows = model.replay.flows.filter((f) => (f.tradeId ? ids.has(f.tradeId) : false));
  const settled = model.replay.realizations.filter((r) => r.settled && r.assetKey === key);
  const cashflows = [
    ...flows.map((f) => ({ date: f.date, amount: f.cashBase ?? NaN })),
    ...settled.map((r) => ({ date: tradeDate({ occurredAt: r.closedAt }), amount: r.direction === 'long' ? r.proceedsBase ?? NaN : -(r.costBase ?? NaN) })),
    ...dividends.map((c) => ({ date: tradeDate(c), amount: c.amount * (fx(c.currency, base, tradeDate(c)) ?? NaN) })),
    ...(h?.valueBase !== undefined ? [{ date: today, amount: h.valueBase }] : []),
  ];
  const r = cashflows.every((f) => Number.isFinite(f.amount)) && (h ? h.valueBase !== undefined : true) ? xirr(cashflows) : undefined;

  const series = input.prices.get(key);
  const firstDay = tradeDate(trades[0]);
  const points = (series?.points ?? []).filter((p) => p.date >= firstDay.slice(0, 4) + '-01-01' || p.date >= firstDay).map((p) => ({ d: p.date, c: p.close }));
  const marks =
    series && trades.every((t) => (t.currency ?? '') === series.currency)
      ? trades.map((t) => ({ d: tradeDate(t), side: t.side, q: t.quantity, p: t.price }))
      : [];

  const here = new URLSearchParams({ type });
  const path = `/holdings/${encodeURIComponent(symbol)}`;
  const biggest = [...(h?.accounts ?? [])].sort((a, b) => Math.abs(b.quantity) - Math.abs(a.quantity))[0];
  const long = (h?.quantity ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px]">
            <Link href="/holdings" className="text-accent hover:underline">
              Holdings
            </Link>
            <span className="text-ink-3">/</span>
          </div>
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold">
            {symbol}
            <span className="truncate text-[13px] font-normal text-ink-3">
              {contract ? contractLabel(contract, type) : name}
              {h?.exchange ? ` · ${h.exchange}` : ''}
            </span>
          </h1>
          {h?.price !== undefined ? (
            <p className="num text-[13px]">
              {price(h.price, currency)} <span className={toneClass(h.dayChangePct)}>{pct(h.dayChangePct)}</span>
              <span className="ml-2 text-2xs text-ink-3">
                {h.priceSource === 'eod' ? `NSE settlement ${h.priceDate}` : h.priceSource === 'nav' ? `NAV ${h.priceDate}` : h.priceSource === 'trade' ? 'last trade' : 'live'}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {type !== 'future' && type !== 'option' ? (
            <ButtonLink href={sheetHref(path, here, { cash: 'new', kind: 'dividend', symbol, type, platform: biggest?.platform, currency })} scroll={false} size="sm" variant="ghost">
              Add dividend
            </ButtonLink>
          ) : null}
          <ButtonLink href={sheetHref(path, here, { trade: 'new', side: 'BUY', symbol, type, platform: biggest?.platform })} scroll={false} size="sm">
            Buy
          </ButtonLink>
          {h ? (
            <ButtonLink
              href={sheetHref(path, here, { trade: 'new', side: long ? 'SELL' : 'BUY', symbol, type, platform: biggest?.platform, qty: biggest ? Math.abs(biggest.quantity) : undefined })}
              scroll={false}
              size="sm"
              variant="primary"
            >
              {long ? 'Sell' : 'Close short'}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Quantity" sub={contract?.lotSize && h ? `${qty(Math.abs(h.quantity) / contract.lotSize)} lots` : h?.platforms.join(', ')}>
          {h ? qty(h.quantity) : 'Closed'}
        </Stat>
        <Stat label="Avg cost">{h ? price(Math.abs(h.avgCost), h.tradeCurrency ?? base) : '—'}</Stat>
        <Stat label="Cost">{money(h?.costBasisBase, base, 0)}</Stat>
        <Stat label="Value">{money(h?.valueBase, base, 0)}</Stat>
        <Stat label="Unrealized" sub={pct(h?.unrealizedPct)}>
          <span className={toneClass(unrealized)}>{moneyDelta(unrealized, base, 0)}</span>
        </Stat>
        <Stat label="Realized">
          <span className={toneClass(realized)}>{moneyDelta(realized, base, 0)}</span>
        </Stat>
        <Stat label="Total return" sub={income ? `incl. ${money(income, base, 0)} dividends` : undefined}>
          <span className={toneClass(totalReturn)}>{moneyDelta(totalReturn, base, 0)}</span>
        </Stat>
        <Stat label="XIRR" sub="a year">
          {pct(r === undefined ? undefined : r * 100, 2, false)}
        </Stat>
      </div>

      {points.length > 1 ? (
        <Panel>
          <PanelHeader title="Price" meta={`${currency} · daily close${marks.length ? ' · ▲ buys ▽ sells' : ''}`} />
          <PriceChart points={points} marks={marks} currency={currency} />
        </Panel>
      ) : null}

      {lots.length ? (
        <Panel>
          <PanelHeader title={`Open lots · ${lots.length}`} meta={snapshot.settings.costMethod === 'fifo' ? 'sold oldest first (FIFO)' : 'average cost; dates sold oldest first'} />
          <Table>
            <thead>
              <tr>
                <Th>Opened</Th>
                <Th wide>Platform</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Unit cost</Th>
                <Th numeric wide>Held</Th>
                <Th wide>Term now</Th>
                <Th numeric>Unrealized</Th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l, i) => {
                const u = h?.price !== undefined && rateNow !== undefined && Number.isFinite(l.unitCostBase) ? l.qty * h.price * rateNow - l.qty * l.unitCostBase : undefined;
                return (
                  <Tr key={i}>
                    <Td className="num text-ink-2">{day(l.openedAt)}</Td>
                    <Td wide className="text-ink-2">{l.platform}</Td>
                    <Td numeric>{qty(l.qty)}</Td>
                    <Td numeric>{price(l.unitCost, h?.tradeCurrency ?? base)}</Td>
                    <Td numeric wide className="text-ink-2">{daysHeld(l.openedAt, today)}d</Td>
                    <Td wide className="text-2xs uppercase tracking-[0.04em] text-ink-2">
                      {type === 'future' || type === 'option' ? '—' : termOf(l.openedAt, new Date().toISOString(), snapshot.settings.longTermMonths)}
                    </Td>
                    <Td numeric className={toneClass(u)}>{moneyDelta(u, base, 0)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={`Trades · ${trades.length}`} />
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Side</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Price</Th>
                <Th wide>Platform</Th>
              </tr>
            </thead>
            <tbody>
              {[...trades].reverse().map((t) => (
                <Tr key={t.id}>
                  <Td className="num text-ink-2">
                    <Link href={sheetHref(path, here, { trade: t.id })} scroll={false} className="hover:underline">
                      {day(t.occurredAt)}
                    </Link>
                  </Td>
                  <Td className={cn('text-2xs font-medium uppercase tracking-[0.04em]', t.side === 'BUY' ? 'text-ink' : 'text-ink-2')}>{t.side === 'BUY' ? 'Buy' : 'Sell'}</Td>
                  <Td numeric>{qty(t.quantity)}</Td>
                  <Td numeric>{price(t.price, t.currency ?? base)}</Td>
                  <Td wide className="text-ink-2">{t.platform}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel>
          <PanelHeader title={`Sales · ${sales.length}`} meta={base} />
          {sales.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Sold</Th>
                  <Th numeric>Qty</Th>
                  <Th wide>Term</Th>
                  <Th numeric wide>Cost</Th>
                  <Th numeric>P&amp;L</Th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <Tr key={s.key}>
                    <Td className="num text-ink-2">
                      {day(s.closedAt)}
                      {s.settled ? <span className="ml-1 text-2xs text-ink-3">expiry</span> : null}
                    </Td>
                    <Td numeric>{qty(s.quantity)}</Td>
                    <Td wide className="text-2xs uppercase tracking-[0.04em] text-ink-2">{s.term}</Td>
                    <Td numeric wide className="text-ink-2">{money(s.costBase, base, 0)}</Td>
                    <Td numeric className={toneClass(s.pnlBase)}>{moneyDelta(s.pnlBase, base, 0)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="px-3 py-4 text-[13px] text-ink-3">Nothing sold yet.</p>
          )}
        </Panel>
      </div>

      {dividends.length || suggestions.length ? (
        <Panel>
          <PanelHeader title="Dividends" />
          <Table>
            <tbody>
              {suggestions.map((s) => (
                <Tr key={`${s.platform}|${s.exDate}`} className="bg-warn-soft/40">
                  <Td className="num text-ink-2">{day(`${s.exDate}T00:00:00Z`)}</Td>
                  <Td className="text-2xs text-warn">
                    Not logged<span className="hidden sm:inline"> · {qty(s.quantity)} × {money(s.perShare, s.currency)} on {s.platform}</span>
                  </Td>
                  <Td numeric>{money(s.amount, s.currency)}</Td>
                  <Td className="text-right">
                    <Link
                      href={sheetHref(path, here, { cash: 'new', kind: 'dividend', symbol, type, platform: s.platform, amount: s.amount.toFixed(2), currency: s.currency, date: s.exDate })}
                      scroll={false}
                      className="rounded-sm border border-line-strong px-1.5 py-0.5 text-2xs text-ink-2 hover:bg-subtle hover:text-ink"
                    >
                      Add
                    </Link>
                  </Td>
                </Tr>
              ))}
              {[...dividends].reverse().map((c) => (
                <Tr key={c.id}>
                  <Td className="num text-ink-2">
                    <Link href={sheetHref(path, here, { cash: c.id })} scroll={false} className="hover:underline">
                      {day(c.occurredAt)}
                    </Link>
                  </Td>
                  <Td className="text-2xs text-ink-2">{c.platform}</Td>
                  <Td numeric className="text-pos">+{money(c.amount, c.currency)}</Td>
                  <Td />
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      ) : null}

      <EntrySheets basePath={path} searchParams={sp} />
    </div>
  );
}
