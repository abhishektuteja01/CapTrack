// src/lib/services/prices/mfapi.ts
// Indian mutual fund NAVs from mfapi.in (free, no key; mirrors AMFI's daily NAV file).
// A fund is identified by its AMFI scheme code, e.g. 119551.

import type { PricePoint } from '@/lib/domain/portfolio/history';

const BASE = 'https://api.mfapi.in/mf';

export function isSchemeCode(symbol: string) {
  return /^\d{5,6}$/.test(symbol.trim());
}

type MfResponse = {
  meta?: { scheme_name?: string; fund_house?: string };
  data?: { date: string; nav: string }[];
};

/** "15-10-2026" → "2026-10-15" */
function isoFromDmy(d: string) {
  const [dd, mm, yyyy] = d.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

function points(json: MfResponse): PricePoint[] {
  return (json.data ?? [])
    .map((r) => ({ date: isoFromDmy(r.date), close: Number(r.nav) }))
    .filter((p) => p.close > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Full NAV history (INR). Throws on failure. */
export async function fetchMfHistory(code: string, from?: string): Promise<{ name?: string; currency: 'INR'; points: PricePoint[] }> {
  const res = await fetch(`${BASE}/${code}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`mfapi ${res.status} for ${code}`);
  const json = (await res.json()) as MfResponse;
  const pts = points(json);
  if (!pts.length) throw new Error(`mfapi: no NAVs for ${code}`);
  return { name: json.meta?.scheme_name, currency: 'INR', points: from ? pts.filter((p) => p.date >= from) : pts };
}

/** Latest two NAVs, for a quote with a day change. */
export async function fetchMfLatest(code: string): Promise<{ name?: string; nav: number; date: string; previous?: number }> {
  const res = await fetch(`${BASE}/${code}`, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`mfapi ${res.status} for ${code}`);
  const json = (await res.json()) as MfResponse;
  const pts = points(json);
  const last = pts[pts.length - 1];
  if (!last) throw new Error(`mfapi: no NAVs for ${code}`);
  return { name: json.meta?.scheme_name, nav: last.close, date: last.date, previous: pts[pts.length - 2]?.close };
}

/** Search schemes by name. Fails soft. */
export async function searchMf(q: string): Promise<{ code: string; name: string }[]> {
  try {
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const json = (await res.json()) as { schemeCode: number; schemeName: string }[];
    return json.slice(0, 10).map((r) => ({ code: String(r.schemeCode), name: r.schemeName }));
  } catch {
    return [];
  }
}
