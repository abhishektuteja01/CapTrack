'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { price as fmtPrice, qty } from '@/lib/format';

export type PriceMark = { d: string; side: 'BUY' | 'SELL'; q: number; p: number };

const H = 200;
const PAD = { top: 14, right: 8, bottom: 22, left: 0 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/**
 * Daily closes with your trades on top: filled triangles up for buys, outlined down for sells,
 * at the price you traded. Hover or arrow keys read any day.
 */
export function PriceChart({ points, marks, currency }: { points: { d: string; c: number }[]; marks: PriceMark[]; currency: string }) {
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (points.length < 2 || !width) return null;
    const vals = [...points.map((p) => p.c), ...marks.map((m) => m.p)];
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    const span = max - min || Math.abs(max) || 1;
    min -= span * 0.06;
    max += span * 0.06;
    const t0 = Date.parse(points[0].d);
    const tSpan = Date.parse(points[points.length - 1].d) - t0 || 1;
    const plotW = width - PAD.left - PAD.right;
    const xt = (d: string) => PAD.left + (plotW * (Date.parse(d) - t0)) / tSpan;
    const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - min) / (max - min));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${xt(p.d).toFixed(1)} ${y(p.c).toFixed(1)}`).join(' ');
    return { xt, y, line, t0, tSpan, plotW, min, max };
  }, [points, marks, width]);

  function indexAt(clientX: number) {
    if (!geo || !box.current) return null;
    const t = geo.t0 + ((clientX - box.current.getBoundingClientRect().left - PAD.left) / geo.plotW) * geo.tSpan;
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (Date.parse(points[mid].d) <= t) lo = mid;
      else hi = mid;
    }
    return t - Date.parse(points[lo].d) <= Date.parse(points[hi].d) - t ? lo : hi;
  }

  const h = hover !== null ? points[hover] : undefined;
  const dayMarks = h ? marks.filter((m) => m.d === h.d) : [];
  const last = points[points.length - 1];

  return (
    <div
      ref={box}
      className="relative mx-3 my-2 outline-none"
      // pan-y: a sideways drag reads the chart on phones, an up-down one still scrolls the page.
      style={{ height: H, touchAction: 'pan-y' }}
      tabIndex={0}
      role="img"
      aria-label={last ? `Price ${fmtPrice(last.c, currency)} on ${fmtDate(last.d)}, with ${marks.length} trades marked. Use arrow keys to read other days.` : 'No price history'}
      onPointerMove={(e) => setHover(indexAt(e.clientX))}
      onPointerLeave={() => setHover(null)}
      onBlur={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const cur = hover ?? points.length - 1;
        setHover(Math.max(0, Math.min(points.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
      }}
    >
      {geo ? (
        <svg width={width} height={H} className="block" aria-hidden="true">
          <line x1={PAD.left} x2={width - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--color-line-strong)" />
          <text x={PAD.left} y={PAD.top - 3} fontSize="10.5" fill="var(--color-ink-3)" className="num">
            {fmtPrice(geo.max, currency)}
          </text>
          <text x={PAD.left} y={H - PAD.bottom - 4} fontSize="10.5" fill="var(--color-ink-3)" className="num">
            {fmtPrice(geo.min, currency)}
          </text>
          <text x={PAD.left} y={H - 6} fontSize="10.5" fill="var(--color-ink-3)" className="num">
            {fmtDate(points[0].d)}
          </text>
          <text x={width - PAD.right} y={H - 6} fontSize="10.5" fill="var(--color-ink-3)" textAnchor="end" className="num">
            {fmtDate(last.d)}
          </text>
          <path d={geo.line} fill="none" stroke="var(--color-ink-3)" strokeWidth="1.25" strokeLinejoin="round" />
          {marks.map((m, i) => {
            const x = geo.xt(m.d);
            const y = geo.y(m.p);
            return m.side === 'BUY' ? (
              <path key={i} d={`M${x} ${y - 5} L${x + 5} ${y + 4} L${x - 5} ${y + 4} Z`} fill="var(--color-accent)" />
            ) : (
              <path key={i} d={`M${x} ${y + 5} L${x + 5} ${y - 4} L${x - 5} ${y - 4} Z`} fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.25" />
            );
          })}
          {hover !== null ? (
            <g>
              <line x1={geo.xt(points[hover].d)} x2={geo.xt(points[hover].d)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-ink-3)" />
              <circle cx={geo.xt(points[hover].d)} cy={geo.y(points[hover].c)} r="3.5" fill="var(--color-ink)" stroke="var(--color-surface)" strokeWidth="1.5" />
            </g>
          ) : null}
        </svg>
      ) : null}
      {h && geo ? (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-md border border-line bg-surface px-2.5 py-2 text-2xs"
          style={geo.xt(h.d) > width / 2 ? { right: width - geo.xt(h.d) + 10 } : { left: geo.xt(h.d) + 10 }}
        >
          <div className="mb-1 text-ink-3">{fmtDate(h.d)}</div>
          <div className="num text-[13px] font-medium text-ink">{fmtPrice(h.c, currency)}</div>
          {dayMarks.map((m, i) => (
            <div key={i} className="num text-ink-2">
              {m.side === 'BUY' ? 'Bought' : 'Sold'} {qty(m.q)} at {fmtPrice(m.p, currency)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
