

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
  'future',
  'option',
  'other',
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
    .string({ error: 'Enter a symbol' })
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
  occurredAt: z
    .string({ error: 'Pick a date' })
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Pick a valid date'),

  asset: assetRefSchema,

  side: tradeSideSchema,

  quantity: z
    .number({ error: 'Enter a quantity' })
    .positive('Quantity must be greater than 0'),

  price: z
    .number({ error: 'Enter the price per unit' })
    .nonnegative('Price cannot be negative'),

  fees: z
    .number({ error: 'Enter fees as a number' })
    .nonnegative('Fees cannot be negative')
    .default(0),

  currency: z
    .string({ error: 'Enter a currency code' })
    .trim()
    .length(3, 'Use a 3-letter code like USD or INR')
    .transform((c) => c.toUpperCase()),

  /** Rate the broker used: 1 unit of `currency` = fxRate units of fxQuote. Optional. */
  fxRate: z.number().positive('Rate must be greater than 0').optional(),

  fxQuote: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((c) => c.toUpperCase())
    .optional(),

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

  notes: z.string().max(500, 'Notes can be up to 500 characters').optional(),

  /** Broker's trade id, so re-importing the same file skips rows already saved. */
  externalId: z.string().trim().min(1).max(128).optional(),

  /** Futures and options only. */
  contract: z
    .object({
      underlying: z.string().trim().min(1, 'Enter the underlying').max(32).transform((s) => s.toUpperCase()),
      expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the expiry date'),
      strike: z.number().nonnegative('Strike cannot be negative').optional(),
      optionType: z.enum(['CE', 'PE']).optional(),
      lotSize: z.number().positive('Lot size must be more than 0').optional(),
    })
    .optional(),
}).superRefine((t, ctx) => {
  const derivative = t.asset.type === 'future' || t.asset.type === 'option';
  if (derivative && !t.contract) ctx.addIssue({ code: 'custom', path: ['contract'], message: 'Pick a contract' });
  if (t.asset.type === 'option' && t.contract && (t.contract.strike === undefined || !t.contract.optionType)) {
    ctx.addIssue({ code: 'custom', path: ['contract'], message: 'Options need a strike and CE or PE' });
  }
});

export const cashKindSchema = z.enum(['deposit', 'withdrawal', 'dividend', 'interest', 'fee']);

export const cashSchema = z
  .object({
    occurredAt: z
      .string({ error: 'Pick a date' })
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Pick a valid date'),
    kind: cashKindSchema,
    amount: z.number({ error: 'Enter an amount' }).positive('Amount must be more than 0'),
    currency: z
      .string({ error: 'Enter a currency code' })
      .trim()
      .length(3, 'Use a 3-letter code like USD or INR')
      .transform((c) => c.toUpperCase()),
    platform: z.preprocess(
      (v) => (v === undefined || v === null || String(v).trim() === '' ? 'Manual' : v),
      z.string().trim().min(1).max(64, 'Platform name is too long')
    ),
    assetSymbol: z.string().trim().max(64).transform((s) => s.toUpperCase()).optional(),
    assetType: assetTypeSchema.optional(),
    notes: z.string().max(500, 'Notes can be up to 500 characters').optional(),
    externalId: z.string().trim().min(1).max(128).optional(),
  })
  .superRefine((c, ctx) => {
    if (c.kind === 'dividend' && !c.assetSymbol) ctx.addIssue({ code: 'custom', path: ['assetSymbol'], message: 'Which holding paid it?' });
  });

export type CashInput = z.infer<typeof cashSchema>;

/**
 * Type helpers derived from the schema
 */
export type TradeInput = z.infer<typeof tradeSchema>;