// src/lib/sheet-links.ts
// The add/edit panels open from the URL on any page (?trade=new, ?trade=<id>, ?cash=new …), so they
// survive refresh and the back button closes them. These build those links.

/**
 * Params that belong to a panel; everything else is the page's own state (filters, page number).
 * Prefill keys start with `f_` so they never collide with a page's own `platform`, `type` or `kind`.
 */
export const SHEET_KEYS = ['trade', 'cash', 'f_symbol', 'f_type', 'f_side', 'f_platform', 'f_qty', 'f_kind', 'f_amount', 'f_currency', 'f_date'] as const;

export type SheetOpen = {
  trade?: string;
  cash?: string;
  symbol?: string;
  type?: string;
  side?: 'BUY' | 'SELL';
  platform?: string;
  qty?: number | string;
  kind?: string;
  amount?: number | string;
  currency?: string;
  date?: string;
};

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

function own(current: Params): URLSearchParams {
  const q = new URLSearchParams();
  const entries =
    current instanceof URLSearchParams
      ? Array.from(current.entries())
      : Object.entries(current).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v === undefined ? [] : [[k, v]]));
  for (const [k, v] of entries) if (!(SHEET_KEYS as readonly string[]).includes(k)) q.append(k, v);
  return q;
}

/** The page without any panel open. */
export function closeHref(base: string, current: Params = {}) {
  const q = own(current);
  return q.size ? `${base}?${q}` : base;
}

/** The page with a panel open, e.g. `{ trade: 'new', side: 'SELL', symbol: 'INFY.NS' }`. */
export function sheetHref(base: string, current: Params, open: SheetOpen) {
  const q = own(current);
  for (const [k, v] of Object.entries(open)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k === 'trade' || k === 'cash' ? k : `f_${k}`, String(v));
  }
  return `${base}?${q}`;
}

/** A holding's own page. */
export function holdingHref(h: { symbol: string; type: string }) {
  return `/holdings/${encodeURIComponent(h.symbol)}?type=${h.type}`;
}
