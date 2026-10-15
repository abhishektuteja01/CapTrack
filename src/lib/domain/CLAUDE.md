# Domain Logic

Pure business logic with **no framework or database dependencies**. Import nothing from Next.js, Supabase, or React here.

## Position Derivation

`portfolio/positions.ts` exports:

- **`derivePositions(trades, opts?)`** — Takes `TradeLike[]`, returns `Position[]`.
  - Sorts trades by `occurredAt` ascending; **average-cost method**
  - SELL books realized P&L: `soldQty*price − sellFees − soldQty*avgCost`
  - `baseCurrency` + `fx` (an `FxLookup`) also track `costBasisBase` / `realizedBase` at trade-date FX; a trade's `fxRate`/`fxQuote` override wins when it quotes the base currency. Base fields are `undefined` if any rate was missing.
  - `includeClosed` keeps fully sold positions (`closed: true`); default drops them
  - `sellBehavior`: `'clamp'` (default) or `'allow_negative'`
- **`applyTrade(ledger, trade, rateToBase)`** — the single-trade step, shared with history replay.
- **`getPositionForAsset(positions, asset)`** — Lookup helper.

## History and returns

- `portfolio/history.ts` — `buildHistory()` replays trades over daily closes + FX into `{date, value, costBasis, partial}` per day in the base currency. `portfolioCashFlows()` builds XIRR flows.
- `portfolio/xirr.ts` — `xirr(flows)` by bisection; returns a ratio (0.12 = 12%) or `undefined`.

## Splits

- `portfolio/splits.ts` — `Split {date, ratio}`. `derivePositions(…, { splits })` and `buildHistory(…, { splits })` multiply held quantity at each split date (cost unchanged). `unadjustForSplits()` restores actually-traded prices when Yahoo split-adjusts its history; `detectImpliedSplits()` finds unreported splits from exact 1/n jumps (n ≥ 5).

## FX

- `fx/rates.ts` — Rates are stored as USD per 1 unit; `makeFxLookup(rows)` converts any pair through USD using the latest rate on or before the date. `normalizeCurrency()` maps minor units (GBp, ZAc, ILA) to major units.

## Testing

Tests live in `portfolio/__tests__/` and `fx/__tests__/` (Vitest).

```bash
npx vitest run src/lib/domain
```

When modifying position logic, always run this test file. Add test cases for any new edge cases.
