

// src/lib/validators/trade.ts

import { z } from 'zod';
import type { AssetType, TradeSide, TradeSource } from '@/lib/types/trades';

/**
 * Reusable enums so types + runtime validation stay aligned
 */
export const assetTypeSchema = z.enum([
  'stock',
  'etf',
  'mutual_fund',
  'crypto',
  'cash',
] satisfies AssetType[]);

export const tradeSideSchema = z.enum(['BUY', 'SELL'] satisfies TradeSide[]);

export const tradeSourceSchema = z.enum([
  'manual',
  'import',
  'adjustment',
] satisfies TradeSource[]);

/**
 * Asset reference validation
 */
export const assetRefSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required')
    .transform((s) => s.toUpperCase()),

  type: assetTypeSchema,

  name: z.string().optional(),
});

/**
 * Core Trade validation schema
 * This enforces *what is allowed*, not portfolio-level constraints.
 */
export const tradeSchema = z.object({
  portfolioId: z.string().uuid('Invalid portfolio id'),

  occurredAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid ISO timestamp'),

  asset: assetRefSchema,

  side: tradeSideSchema,

  quantity: z
    .number()
    .positive('Quantity must be greater than 0'),

  price: z
    .number()
    .nonnegative('Price cannot be negative'),

  fees: z
    .number()
    .nonnegative('Fees cannot be negative')
    .default(0),

  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((c) => c.toUpperCase()),

  platform: z
    .preprocess(
      (v) => (v === undefined || v === null || String(v).trim() === '' ? 'Manual' : v),
      z
        .string()
        .trim()
        .min(1, 'Platform is required')
        .max(64, 'Platform name is too long')
    ),

  source: tradeSourceSchema,

  notes: z.string().optional(),
});

/**
 * Type helpers derived from the schema
 */
export type TradeInput = z.infer<typeof tradeSchema>;