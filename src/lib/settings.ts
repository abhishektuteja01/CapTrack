// src/lib/settings.ts
// User settings helpers shared by pages and actions.

import { z } from 'zod';

/** Trim, drop blanks and case-insensitive duplicates. Falls back to ['Manual']. */
export function normalizePlatforms(raw: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of (raw ?? []).map((s) => String(s).trim()).filter(Boolean)) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out.length ? out : ['Manual'];
}

/** ISO 4217 codes the runtime knows about. */
export function isoCurrencies(): string[] {
  try {
    return Intl.supportedValuesOf('currency');
  } catch {
    return ['USD', 'INR', 'EUR', 'GBP', 'JPY'];
  }
}

export const currencySchema = z
  .string()
  .trim()
  .transform((c) => c.toUpperCase())
  .refine((c) => /^[A-Z]{3}$/.test(c) && isoCurrencies().includes(c), 'Pick a valid currency code');

export const platformsSchema = z
  .array(z.string().trim().min(1).max(64, 'Platform names must be 64 characters or fewer'))
  .max(50, 'Up to 50 platforms')
  .transform(normalizePlatforms);
