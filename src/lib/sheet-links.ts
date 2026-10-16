// src/lib/sheet-links.ts
// The add/edit panels open from the URL on any page (?trade=new, ?trade=<id>, ?cash=new …), so they
// survive refresh and the back button closes them. These build those links.

/** Params that belong to a panel; everything else is the page's own state (filters, page number). */
export const SHEET_KEYS = ['trade', 'cash', 'symbol', 'type', 'side', 'platform', 'qty', 'kind', 'amount', 'currency', 'date'] as const;

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
export function sheetHref(base: string, current: Params, open: Record<string, string | number | undefined | null>) {
  const q = own(current);
  for (const [k, v] of Object.entries(open)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  return `${base}?${q}`;
}

/** A holding's own page. */
export function holdingHref(h: { symbol: string; type: string }) {
  return `/holdings/${encodeURIComponent(h.symbol)}?type=${h.type}`;
}
