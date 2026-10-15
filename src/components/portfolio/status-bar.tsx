import type { PortfolioSnapshot } from '@/lib/portfolio';
import { rate } from '@/lib/format';
import { LocalTime } from '@/components/ui/local-time';

/** Where the numbers came from and how fresh they are. Always visible under the data. */
export function StatusBar({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const { pricesAsOf, pricesStale: stale, fx, baseCurrency } = snapshot;
  return (
    <div className="num flex flex-wrap gap-x-4 gap-y-1 px-0.5 text-2xs text-ink-3">
      <span className={stale ? 'text-warn' : 'text-ink-2'}>
        {pricesAsOf ? (
          <>
            Prices <LocalTime ms={pricesAsOf} /> · Yahoo Finance
          </>
        ) : (
          'Prices unavailable'
        )}
        {stale ? ' · not updated in 4+ days' : ''}
      </span>
      {fx.rates.map((r) => (
        <span key={r.currency}>
          {r.currency}/{baseCurrency} {rate(r.toBase)}
        </span>
      ))}
      {fx.rates.length ? <span>FX rates of {fx.date}</span> : null}
    </div>
  );
}
