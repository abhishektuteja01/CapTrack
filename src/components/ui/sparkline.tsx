import { cn } from '@/lib/utils';

/** Tiny intraday line. Colored by the day's direction against `reference` (previous close). */
export function Sparkline({
  values,
  reference,
  width = 64,
  height = 18,
  className,
}: {
  values: number[];
  reference?: number;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return <span className={cn('inline-block', className)} style={{ width, height }} />;
  // keep at most ~60 points
  const step = Math.max(1, Math.floor(values.length / 60));
  const pts = values.filter((_, i) => i % step === 0 || i === values.length - 1);
  const all = reference !== undefined ? [...pts, reference] : pts;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => (i / (pts.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const up = last >= (reference ?? pts[0]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      {reference !== undefined ? (
        <line x1="0" x2={width} y1={y(reference)} y2={y(reference)} stroke="var(--color-line-strong)" strokeDasharray="2 2" strokeWidth="1" />
      ) : null}
      <path d={d} fill="none" stroke={up ? 'var(--color-pos)' : 'var(--color-neg)'} strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}
