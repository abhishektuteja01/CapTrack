// src/lib/types/trades.ts

/**
 * High-level asset categories CapTrack supports.
 * Keep this broad; provider-specific details belong elsewhere.
 */
export type AssetType = 'stock' | 'etf' | 'mutual_fund' | 'crypto' | 'cash';

/**
 * BUY increases your position. SELL decreases it.
 */
export type TradeSide = 'BUY' | 'SELL';

/**
 * ISO 4217 currency codes (keep open-ended; we validate elsewhere).
 * Examples: 'USD', 'INR', 'EUR'
 */
export type CurrencyCode = string;

/**
 * Where this trade came from.
 * - manual: user entered
 * - import: CSV/connector later
 * - adjustment: admin/manual correction, split fixes, etc.
 */
export type TradeSource = 'manual' | 'import' | 'adjustment';

/**
 * Minimal identifier for an asset.
 * For v1, "symbol" is enough. Later you can add provider IDs (FIGI, ISIN, CoinGecko id, etc.).
 */
export interface AssetRef {
  symbol: string; // e.g., 'AAPL', 'VTI', 'BTC'
  type: AssetType;
  name?: string; // optional display name
}

/**
 * A Trade is the atomic, immutable "fact" in the portfolio.
 * Positions / cost basis / PnL are derived from the sequence of trades.
 */
export interface Trade {
  id: string; // uuid
  portfolioId: string; // keep even if single-user for now (future-proof)
  occurredAt: string; // ISO timestamp, e.g. '2025-12-29T18:05:00.000Z'

  asset: AssetRef;
  side: TradeSide;

  quantity: number; // shares/units/coins, must be > 0
  price: number; // price per unit in `currency`, must be >= 0

  fees: number; // total fees in `currency`, must be >= 0
  currency: CurrencyCode;

  source: TradeSource;
  notes?: string;
}

/**
 * Convenience type for creating trades before an id is assigned.
 */
export type NewTrade = Omit<Trade, 'id'>;