import { money, moneyDelta, pct, sign } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Gain/loss text color. Unknown and zero stay ink. */
export function toneClass(v: number | null | undefined) {
  const s = sign(v);
  return s > 0 ? 'text-pos' : s < 0 ? 'text-neg' : '';
}

export function Money({
  value,
  currency,
  decimals,
  className,
}: {
  value: number | null | undefined;
  currency: string;
  decimals?: number;
  className?: string;
}) {
  return <span className={cn('num', className)}>{money(value, currency, decimals)}</span>;
}

/** Signed money change, colored by direction. */
export function Delta({
  value,
  currency,
  decimals,
  className,
}: {
  value: number | null | undefined;
  currency: string;
  decimals?: number;
  className?: string;
}) {
  return <span className={cn('num', toneClass(value), className)}>{moneyDelta(value, currency, decimals)}</span>;
}

/** Signed percent, colored by direction unless `plain`. */
export function Pct({
  value,
  decimals,
  plain,
  className,
}: {
  value: number | null | undefined;
  decimals?: number;
  plain?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('num', !plain && toneClass(value), className)}>{pct(value, decimals, !plain)}</span>
  );
}
