// src/lib/domain/portfolio/positions.ts
// Pure domain logic: derive current positions from a trade stream.
// No Supabase/Next imports here.

export type AssetType = 'stock' | 'etf' | 'mutual_fund' | 'crypto' | 'cash' | string;
export type TradeSide = 'BUY' | 'SELL';

export type TradeLike = {
  id?: string;
  occurredAt: string; // ISO string
  asset: {
    symbol: string;
    type: AssetType;
  };
  side: TradeSide;
  quantity: number;
  price: number;
  fees?: number;
  currency?: string;
};

export type Position = {
  asset: {
    symbol: string;
    type: AssetType;
  };
  currency?: string;

  // current holdings
  quantity: number;

  // average cost per unit for remaining units (avg-cost method)
  avgCost: number;

  // total cost basis for remaining units
  costBasis: number;

  // total fees paid (for informational display)
  totalFees: number;
};

export type DerivePositionsOptions = {
  /**
   * How to handle sells that exceed current quantity.
   * - 'clamp': never let quantity go negative; clamp sell to available qty
   * - 'allow_negative': permit negative holdings (not recommended for v1)
   */
  sellBehavior?: 'clamp' | 'allow_negative';

  /** Treat missing fees as 0. */
  defaultFees?: number;
};

function assetKey(symbol: string, type: AssetType) {
  return `${type}::${symbol.toUpperCase()}`;
}

function safeNumber(n: unknown, fallback = 0) {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Derive positions using an average-cost method.
 * 
 * Rules:
 * - BUY increases qty and cost basis by (qty * price + fees)
 * - SELL decreases qty and reduces cost basis by (soldQty * currentAvgCost)
 *   (fees are tracked separately so we don't double count)
 */
export function derivePositions(
  trades: TradeLike[],
  opts: DerivePositionsOptions = {}
): Position[] {
  const sellBehavior = opts.sellBehavior ?? 'clamp';
  const defaultFees = opts.defaultFees ?? 0;

  // sort by time ascending to get deterministic running state
  const sorted = [...trades].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  const map = new Map<string, Position>();

  for (const t of sorted) {
    const symbol = t.asset.symbol.toUpperCase().trim();
    const type = t.asset.type;
    const key = assetKey(symbol, type);

    const qty = safeNumber(t.quantity);
    const price = safeNumber(t.price);
    const fees = safeNumber(t.fees, defaultFees);

    if (!symbol || qty <= 0 || price < 0) continue;

    const pos =
      map.get(key) ??
      ({
        asset: { symbol, type },
        currency: t.currency,
        quantity: 0,
        avgCost: 0,
        costBasis: 0,
        totalFees: 0,
      } satisfies Position);

    // preserve first-seen currency (or keep existing)
    if (!pos.currency && t.currency) pos.currency = t.currency;

    if (t.side === 'BUY') {
      pos.quantity += qty;
      pos.costBasis += qty * price + fees;
      pos.totalFees += fees;
    } else {
      const currentQty = pos.quantity;
      const sellQty =
        sellBehavior === 'allow_negative' ? qty : Math.min(qty, Math.max(0, currentQty));

      const currentAvgCost = currentQty > 0 ? pos.costBasis / currentQty : 0;

      pos.quantity = currentQty - sellQty;
      pos.costBasis = Math.max(
        0,
        pos.costBasis - sellQty * currentAvgCost
      );
      pos.totalFees += fees;

      // If we allowed negative and went below zero, costBasis should be 0 (no long lots remaining)
      if (sellBehavior === 'allow_negative' && pos.quantity < 0) {
        pos.costBasis = 0;
      }
    }

    pos.avgCost = pos.quantity > 0 ? pos.costBasis / pos.quantity : 0;

    map.set(key, pos);
  }

  // return stable ordering: by type then symbol
  return Array.from(map.values())
    .filter((p) => p.quantity !== 0 || p.costBasis !== 0 || p.totalFees !== 0)
    .sort((a, b) => {
      if (a.asset.type === b.asset.type) return a.asset.symbol.localeCompare(b.asset.symbol);
      return String(a.asset.type).localeCompare(String(b.asset.type));
    });
}

/** Convenience helper for quickly looking up a single asset's position. */
export function getPositionForAsset(
  positions: Position[],
  asset: { symbol: string; type: AssetType }
): Position | undefined {
  const sym = asset.symbol.toUpperCase().trim();
  const key = assetKey(sym, asset.type);
  return positions.find((p) => assetKey(p.asset.symbol, p.asset.type) === key);
}
