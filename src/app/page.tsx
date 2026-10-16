import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/auth';
import { examplePortfolio } from '@/lib/example-portfolio';
import { ButtonLink } from '@/components/ui/button';
import { OverviewView } from '@/components/portfolio/overview-view';

export const metadata: Metadata = {
  title: { absolute: 'CapTrack · Trades from every broker, in your own currency' },
};

const SPEC: [string, string][] = [
  ['Prices', 'Yahoo Finance for stocks, ETFs and crypto, at most a minute old when the page loads. Indian mutual funds use AMFI’s daily NAV; NSE futures and options use NSE’s end-of-day settlement prices.'],
  ['Exchange rates', 'European Central Bank reference rates for about 30 currencies, Yahoo Finance for the rest. Each trade converts at the rate on its own date, or at your broker’s rate if you enter it.'],
  ['Currencies', 'Any ISO 4217 code for trades and for your base currency. London prices quoted in pence are converted to pounds.'],
  ['Cost basis', 'First in, first out by default, or average cost. Fees included. Lots are kept per broker.'],
  ['Realized P&L', 'Booked on every sell, after fees, at the rate on the sell date, with the holding period split into short and long term by tax year.'],
  ['Money in and out', 'What you put in, what you took out and what’s still invested, so a profitable sale stays visible after you sell.'],
  ['Income', 'Dividends, interest and charges you log count toward total return. Dividends you probably received but haven’t logged are pointed out.'],
  ['Returns', 'Total return and XIRR over your actual cash flows, so money added later doesn’t distort the number, compared with an index of your choice.'],
  ['Splits', 'Applied automatically from Yahoo’s split data. Unreported splits of 5:1 or more are detected from the price.'],
  ['Your data', 'Stored in Postgres with row-level security. Only your account can read your trades. Import a broker CSV, export everything any time.'],
];

const NOT_YET = [
  'No live broker sync. Import your broker’s CSV (Zerodha tradebook or most others) or enter trades yourself.',
  'Demergers and mergers aren’t applied automatically. Splits and bonus issues are.',
  'Futures and options are NSE only, priced at the end of each day.',
];

export default async function Landing() {
  // Signed-in visitors go straight to their numbers.
  if (await getUser()) redirect('/dashboard');

  const example = examplePortfolio();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="text-sm font-semibold">CapTrack</span>
        <nav className="flex items-center gap-1">
          <Link href="/login" className="rounded-md px-2.5 py-1 text-[13px] text-ink-2 hover:bg-subtle hover:text-ink">
            Sign in
          </Link>
          <ButtonLink href="/signup" size="sm" variant="primary">
            Create account
          </ButtonLink>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pt-20">
          <div className="flex flex-col gap-5">
            <h1 className="max-w-[18ch] text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-[44px]">
              Your trades from every broker, valued in your own currency.
            </h1>
          </div>
          <div className="flex flex-col gap-5 lg:pt-2">
            <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
              Log buys and sells from Zerodha, Interactive Brokers, Coinbase or anywhere else, in rupees, dollars,
              euros or any other currency. CapTrack converts each trade at the rate on the day you made it, then shows
              what you hold, what you’ve made, and your annual return.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="/signup" variant="primary" className="h-9 px-4">
                Create a free account
              </ButtonLink>
              <Link href="/login" className="text-[13px] text-accent hover:underline">
                I already have one
              </Link>
            </div>
          </div>
        </section>

        <section aria-label="Example portfolio" className="mx-auto max-w-6xl px-2 sm:px-6">
          <div className="overflow-hidden rounded-md border border-line-strong bg-bg">
            <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-1.5">
              <span className="num hidden text-2xs text-ink-3 sm:inline">Overview · base currency INR</span>
              <span className="text-2xs text-ink-3">Example portfolio, not real data</span>
            </div>
            <div className="p-2 sm:p-4">
              <OverviewView snapshot={example} demo />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <h2 className="text-base font-semibold">How the numbers work</h2>
          <dl className="divide-y divide-line border-y border-line">
            {SPEC.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6">
                <dt className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3 sm:pt-0.5">{k}</dt>
                <dd className="max-w-[68ch] text-[14px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <h2 className="text-base font-semibold">What it doesn’t do yet</h2>
          <ul className="flex flex-col gap-2 text-[14px] text-ink-2">
            {NOT_YET.map((n) => (
              <li key={n} className="flex gap-2">
                <span aria-hidden="true" className="text-ink-3">–</span>
                {n}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
            <p className="max-w-[48ch] text-[15px]">
              Free while it’s a side project. Start with one trade; your history and returns build from there.
            </p>
            <ButtonLink href="/signup" variant="primary" className="h-9 px-4">
              Create a free account
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-2xs text-ink-3 sm:px-6">
        <span>CapTrack</span>
        <span>
          Prices: Yahoo Finance, AMFI, NSE. Exchange rates: European Central Bank. Not investment advice.{' '}
          <a href="https://github.com/abhishektuteja01/CapTrack" className="text-accent hover:underline">
            Source on GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}
