'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartPoint } from '@/lib/portfolio';
import { compactMoney, money, moneyDelta } from '@/lib/format';
import { toneClass } from '@/components/ui/num';
import { cn } from '@/lib/utils';

const RANGES = ['1M', '6M', 'YTD', '1Y', 'All'] as const;
type Range = (typeof RANGES)[number];

function rangeStart(range: Range, last: string): string {
  const d = new Date(`${last}T00:00:00Z`);
  switch (range) {
    case '1M':
      d.setUTCMonth(d.getUTCMonth() - 1);
      break;
    case '6M':
      d.setUTCMonth(d.getUTCMonth() - 6);
      break;
    case '1Y':
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      break;
    case 'YTD':
      return `${last.slice(0, 4)}-01-01`;
    case 'All':
      return '0000-00-00';
  }
  return d.toISOString().slice(0, 10);
}

function niceStep(span: number, target = 4) {
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * mag) return m * mag;
  return 10 * mag;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d: string) {
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}

const H = 220;
const PAD = { top: 18, right: 8, bottom: 22, left: 0 };

/**
 * Portfolio value against money invested (cost basis), straight lines, no fill.
 * Defaults to All so the long view comes first. Hover or arrow keys read any day.
 */
export function PerformanceChart({ points, currency }: { points: ChartPoint[]; currency: string }) {
  const [range, setRange] = useState<Range>('All');
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (!points.length) return [];
    const start = rangeStart(range, points[points.length - 1].d);
    const sliced = points.filter((p) => p.d >= start);
    return sliced.length >= 2 ? sliced : points.slice(-2);
  }, [points, range]);

  const first = data[0];
  const last = data[data.length - 1];
  // Since start: value − invested. Shorter ranges exclude money added: Δvalue − Δinvested.
  const gain =
    first && last ? (range === 'All' ? last.v - last.c : last.v - first.v - (last.c - first.c)) : undefined;

  const geo = useMemo(() => {
    if (data.length < 2 || !width) return null;
    const vals = data.flatMap((p) => [p.v, p.c]);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    const span = max - min || Math.abs(max) || 1;
    min -= span * 0.06;
    max += span * 0.06;
    const step = niceStep(max - min);
    const ticks: number[] = [];
    for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(t);

    const plotW = width - PAD.left - PAD.right;
    // x is proportional to time: history is daily recently and weekly further back
    const t0 = Date.parse(data[0].d);
    const tSpan = Date.parse(data[data.length - 1].d) - t0 || 1;
    const times = data.map((p) => Date.parse(p.d));
    const x = (i: number) => PAD.left + (plotW * (times[i] - t0)) / tSpan;
    const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - min) / (max - min));

    const value = data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    let invested = `M${x(0).toFixed(1)} ${y(data[0].c).toFixed(1)}`;
    for (let i = 1; i < data.length; i++) invested += ` H${x(i).toFixed(1)} V${y(data[i].c).toFixed(1)}`;

    // x labels: years for long spans, months otherwise
    const spanDays = (Date.parse(last.d) - Date.parse(first.d)) / 86400000;
    const labels: { x: number; text: string }[] = [];
    let lastX = -Infinity;
    data.forEach((p, i) => {
      const isYear = i === 0 || data[i - 1].d.slice(0, 4) !== p.d.slice(0, 4);
      const isMonth = i > 0 && data[i - 1].d.slice(5, 7) !== p.d.slice(5, 7);
      const text = spanDays > 540 ? (isYear ? p.d.slice(0, 4) : null) : isMonth ? MONTHS[Number(p.d.slice(5, 7)) - 1] : null;
      if (text && x(i) - lastX > 44 && x(i) < width - 28) {
        labels.push({ x: x(i), text });
        lastX = x(i);
      }
    });

    return { ticks, x, y, value, invested, labels, plotW, times, t0, tSpan };
  }, [data, width, first, last]);

  function indexAt(clientX: number) {
    if (!geo || !boxRef.current) return null;
    const rect = boxRef.current.getBoundingClientRect();
    const t = geo.t0 + ((clientX - rect.left - PAD.left) / geo.plotW) * geo.tSpan;
    // nearest point in time (binary search)
    let lo = 0;
    let hi = data.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (geo.times[mid] <= t) lo = mid;
      else hi = mid;
    }
    return t - geo.times[lo] <= geo.times[hi] - t ? lo : hi;
  }

  const h = hover !== null ? data[hover] : undefined;

  return (
    <div className="flex flex-col gap-2 px-3 pb-2 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-2xs text-ink-3">
          <span className="flex items-center gap-1.5">
            <svg width="14" height="6" aria-hidden="true">
              <line x1="0" x2="14" y1="3" y2="3" stroke="var(--color-accent)" strokeWidth="2" />
            </svg>
            Value
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="6" aria-hidden="true">
              <line x1="0" x2="14" y1="3" y2="3" stroke="var(--color-ink-3)" strokeWidth="1.25" strokeDasharray="3 2" />
            </svg>
            Invested
          </span>
          {gain !== undefined ? (
            <span className="num">
              Gain {range === 'All' ? 'since start' : range}{' '}
              <span className={toneClass(gain)}>{moneyDelta(gain, currency, 0)}</span>
            </span>
          ) : null}
        </div>
        <div role="group" aria-label="Chart range" className="flex">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                setHover(null);
              }}
              className={cn(
                'num rounded-sm px-1.5 py-0.5 text-2xs text-ink-3 hover:text-ink',
                range === r && 'bg-accent-soft text-accent'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={boxRef}
        className="relative outline-none"
        style={{ height: H }}
        tabIndex={0}
        role="img"
        aria-label={
          last
            ? `Portfolio value ${money(last.v, currency, 0)} against ${money(last.c, currency, 0)} invested on ${fmtDate(last.d)}. Use arrow keys to read other days.`
            : 'No history yet'
        }
        onPointerMove={(e) => setHover(indexAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const cur = hover ?? data.length - 1;
          setHover(Math.max(0, Math.min(data.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
        }}
        onBlur={() => setHover(null)}
      >
        {geo ? (
          <svg width={width} height={H} className="block" aria-hidden="true">
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--color-subtle)" />
                <text x={PAD.left} y={geo.y(t) - 4} fontSize="10.5" fill="var(--color-ink-3)" className="num">
                  {compactMoney(t, currency)}
                </text>
              </g>
            ))}
            <line x1={PAD.left} x2={width - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--color-line-strong)" />
            {geo.labels.map((l) => (
              <text key={l.x} x={l.x} y={H - 6} fontSize="10.5" fill="var(--color-ink-3)" className="num">
                {l.text}
              </text>
            ))}
            <path d={geo.invested} fill="none" stroke="var(--color-ink-3)" strokeWidth="1.25" strokeDasharray="4 3" />
            <path d={geo.value} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
            {hover !== null ? (
              <g>
                <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-ink-3)" strokeWidth="1" />
                <circle cx={geo.x(hover)} cy={geo.y(data[hover].c)} r="3.5" fill="var(--color-surface)" stroke="var(--color-ink-3)" strokeWidth="1.5" />
                <circle cx={geo.x(hover)} cy={geo.y(data[hover].v)} r="4" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
              </g>
            ) : (
              <circle cx={geo.x(data.length - 1)} cy={geo.y(last.v)} r="3" fill="var(--color-accent)" />
            )}
          </svg>
        ) : null}

        {h && geo ? (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-md border border-line bg-surface px-2.5 py-2 text-2xs"
            style={
              geo.x(hover!) > width / 2
                ? { right: width - geo.x(hover!) + 10 }
                : { left: geo.x(hover!) + 10 }
            }
          >
            <div className="mb-1 text-ink-3">{fmtDate(h.d)}</div>
            <div className="flex justify-between gap-4">
              <span className="num text-[13px] font-medium text-ink">{money(h.v, currency, 0)}</span>
              <span className="text-ink-3">Value</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="num text-ink">{money(h.c, currency, 0)}</span>
              <span className="text-ink-3">Invested</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={cn('num', toneClass(h.v - h.c))}>{moneyDelta(h.v - h.c, currency, 0)}</span>
              <span className="text-ink-3">Unrealized</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
