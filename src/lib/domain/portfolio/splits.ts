// src/lib/domain/portfolio/splits.ts
// Stock splits. A 10:1 split has ratio 10: holdings ×10, per-unit cost ÷10, total cost unchanged.
// Trades dated before a split are in pre-split units; trades on or after it are in post-split units.

import type { PricePoint } from './history';

export type Split = {
  date: string; // YYYY-MM-DD, first trading day at the new unit
  ratio: number; // new units per old unit (10 for 10:1, 0.1 for a 1:10 reverse split)
  source?: 'yahoo' | 'detected';
};

/** Ratios we'll infer from a price jump alone. Small ones (2:1) are skipped: a real 50% crash looks the same. */
const DETECTABLE = [5, 10, 20, 25, 50, 100];
const TOLERANCE = 0.08;

/**
 * Find splits a data source didn't report: a one-day close change of almost exactly 1/n (or n for reverse splits).
 * Only used when the series has no split events.
 */
export function detectImpliedSplits(points: PricePoint[]): Split[] {
  const out: Split[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].close;
    const cur = points[i].close;
    if (!(prev > 0 && cur > 0)) continue;
    const move = prev / cur; // ≈ n for an n:1 split
    for (const n of DETECTABLE) {
      if (Math.abs(move / n - 1) <= TOLERANCE) out.push({ date: points[i].date, ratio: n, source: 'detected' });
      else if (Math.abs(move * n - 1) <= TOLERANCE) out.push({ date: points[i].date, ratio: 1 / n, source: 'detected' });
    }
  }
  return out;
}

/**
 * Yahoo usually split-adjusts its closes (earlier prices divided by the ratio). Replay needs actual traded prices,
 * so undo the adjustment for each split whose series shows no jump. Series that already jump are left alone.
 */
export function unadjustForSplits(points: PricePoint[], splits: Split[]): PricePoint[] {
  let out = points;
  for (const s of splits) {
    const i = out.findIndex((p) => p.date >= s.date);
    if (i <= 0) continue;
    const jump = out[i - 1].close / out[i].close;
    const looksUnadjusted = Math.abs(jump / s.ratio - 1) <= 0.25;
    if (looksUnadjusted) continue;
    out = out.map((p, k) => (k < i ? { date: p.date, close: p.close * s.ratio } : p));
  }
  return out;
}

/** Merge split lists, one per date (reported splits win over detected ones). */
export function mergeSplits(...lists: Split[][]): Split[] {
  const byDate = new Map<string, Split>();
  for (const list of lists) {
    for (const s of list) {
      const cur = byDate.get(s.date);
      if (!cur || (cur.source === 'detected' && s.source !== 'detected')) byDate.set(s.date, s);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}
