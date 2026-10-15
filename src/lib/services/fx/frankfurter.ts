// src/lib/services/fx/frankfurter.ts
// European Central Bank reference rates via Frankfurter (free, no key).
// Published once per working day around 16:00 CET; past values never change.

import type { UsdRateRow } from '@/lib/domain/fx/rates';

const BASE = 'https://api.frankfurter.dev/v1';

let supported: Promise<Set<string>> | null = null;

/** Currencies the ECB publishes (about 30, plus EUR). */
export function frankfurterCurrencies(): Promise<Set<string>> {
  supported ??= fetch(`${BASE}/currencies`, { next: { revalidate: 86400 } })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: Record<string, string>) => new Set([...Object.keys(j), 'USD']))
    .catch(() => {
      supported = null;
      return new Set<string>();
    });
  return supported;
}

/** Daily USD-per-unit rows for `currencies` between `from` and `to` (inclusive). */
export async function fetchFrankfurterRange(
  currencies: string[],
  from: string,
  to: string
): Promise<UsdRateRow[]> {
  const symbols = currencies.filter((c) => c !== 'USD');
  if (!symbols.length) return [];
  const url = `${BASE}/${from}..${to}?base=USD&symbols=${symbols.join(',')}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Frankfurter ${res.status} for ${url}`);
  const json = (await res.json()) as { rates?: Record<string, Record<string, number>> };

  const rows: UsdRateRow[] = [];
  for (const [date, perUsd] of Object.entries(json.rates ?? {})) {
    for (const [currency, unitsPerUsd] of Object.entries(perUsd)) {
      if (unitsPerUsd > 0) rows.push({ date, currency, usdPerUnit: 1 / unitsPerUsd });
    }
  }
  return rows;
}
