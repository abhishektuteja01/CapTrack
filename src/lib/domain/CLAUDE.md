# Domain Logic

Pure business logic with **no framework or database dependencies**. Import nothing from Next.js, Supabase, or React here.

## Position Derivation

`portfolio/positions.ts` exports:

- **`derivePositions(trades, opts?)`** — Takes a list of `TradeLike` objects, returns `Position[]`.
  - Sorts trades by `occurredAt` ascending
  - Uses **average-cost method**: BUY increases qty and cost basis, SELL reduces both proportionally
  - `sellBehavior` option: `'clamp'` (default, no negative positions) or `'allow_negative'`
  - Filters out zero-quantity positions, returns sorted by asset type then symbol

- **`getPositionForAsset(positions, asset)`** — Lookup helper for a single asset.

## Types (defined in this file, not in types/)

- `TradeLike` — Minimal trade shape needed for derivation (occurredAt, asset, side, quantity, price, fees?, currency?)
- `Position` — Derived holding (asset, quantity, avgCost, costBasis, totalFees, currency)
- `DerivePositionsOptions` — { sellBehavior?, defaultFees? }

## Testing

Tests live in `portfolio/__tests__/positions.test.ts` using Vitest.

```bash
npx vitest run src/lib/domain/portfolio/__tests__/positions.test.ts
```

When modifying position logic, always run this test file. Add test cases for any new edge cases.
