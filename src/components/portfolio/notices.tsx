import Link from 'next/link';
import type { PortfolioSnapshot } from '@/lib/portfolio';
import { holdingHref } from '@/lib/sheet-links';
import { qty } from '@/lib/format';
import { Notice } from '@/components/ui/notice';

/** Things that make the numbers incomplete or wrong, each with what to do about it. */
export function PortfolioNotices({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const missing = [...snapshot.missingQuotes, ...snapshot.missingFx];
  const all = [...snapshot.holdings, ...snapshot.derivatives];
  const oversold = all.filter((h) => h.oversold);
  const unsettled = snapshot.derivatives.filter((h) => h.unsettled);
  return (
    <>
      {missing.length ? (
        <Notice label="Partial totals">
          {missing.join(', ')} {missing.length === 1 ? 'is' : 'are'} left out of value and returns because a price or exchange rate is
          unavailable right now.
        </Notice>
      ) : null}
      {oversold.length ? (
        <Notice label="Missing buys">
          {oversold.map((h, i) => (
            <span key={h.key}>
              {i ? ', ' : ''}
              <Link href={holdingHref(h)} className="underline">
                {h.symbol}
              </Link>{' '}
              ({qty(h.oversold)} more sold than bought)
            </span>
          ))}
          . Add the missing buys so profit is right.
        </Notice>
      ) : null}
      {unsettled.length ? (
        <Notice label="Expired contracts">
          {unsettled.map((h) => h.symbol).join(', ')} expired but NSE&apos;s settlement price isn&apos;t in yet. They&apos;re valued at the last price until it is.
        </Notice>
      ) : null}
      {snapshot.unloggedDividends ? (
        <Notice tone="info" label="Dividends">
          {snapshot.unloggedDividends} {snapshot.unloggedDividends === 1 ? 'dividend looks' : 'dividends look'} unlogged.{' '}
          <Link href="/pnl#dividends" className="text-accent hover:underline">
            Review
          </Link>
        </Notice>
      ) : null}
    </>
  );
}
