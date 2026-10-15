// src/lib/domain/portfolio/xirr.ts
// Annualized money-weighted return (XIRR) from dated cash flows.

export type CashFlow = {
  date: string; // YYYY-MM-DD or ISO
  amount: number; // negative = money in (buy), positive = money out (sell, current value)
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the annual rate r (0.12 = 12%) where Σ amount / (1+r)^(days/365) = 0.
 * Undefined when there is no sign change or the span is under one day.
 */
export function xirr(flows: CashFlow[]): number | undefined {
  const fs = flows
    .filter((f) => Number.isFinite(f.amount) && f.amount !== 0)
    .map((f) => ({ t: new Date(f.date).getTime(), a: f.amount }))
    .sort((x, y) => x.t - y.t);
  if (fs.length < 2) return undefined;
  if (!fs.some((f) => f.a < 0) || !fs.some((f) => f.a > 0)) return undefined;

  const t0 = fs[0].t;
  if (fs[fs.length - 1].t - t0 < DAY_MS) return undefined;

  const npv = (r: number) =>
    fs.reduce((s, f) => s + f.a / Math.pow(1 + r, (f.t - t0) / DAY_MS / 365), 0);

  // npv is decreasing in r for a normal investment profile; bisect.
  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (Number.isNaN(fLo) || Number.isNaN(fHi) || fLo * fHi > 0) return undefined;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}
