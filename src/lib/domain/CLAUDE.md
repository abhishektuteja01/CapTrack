# Domain Logic

Pure business logic with **no framework or database dependencies**. Import nothing from Next.js, Supabase, or React here.

## Lots and positions

`portfolio/positions.ts`:

- **`replay(trades, opts?)`** → `{ positions, realizations, flows }`. Lots per platform (`accountKey`), FIFO by default, `method: 'average'` pools cost. Futures and options can go short; stocks clamp and record `oversold`. `splits`, `asOf`, `baseCurrency` + `fx` (trade-date FX, or the trade's `fxRate`/`fxQuote` override), and `settlement(symbol, contract)` to close expired contracts.
  - `realizations`: one slice per closed lot, with cost, proceeds and P&L in trade and base currency.
  - `flows`: cash each trade moved (futures move only their P&L), incl. the currency that actually left the account.
- **`derivePositions`** (positions only), **`applyTrade`** (one step, shared with history), **`heldOn`** (units on a platform on a date).
- Position `quantity` and `costBasis` are signed (negative for shorts); base fields are `undefined` if any rate was missing.

## Money, tax, dividends, contracts

- `portfolio/money.ts` — `summarizeMoney` (bought, sold, net invested, income, charges, deposits), `cashBalances` (only platforms with deposits/withdrawals), `xirrFlows`.
- `portfolio/tax.ts` — `taxYearOf/Label/Range`, `termOf` (long-term after N months), `saleRows` (one line per sale and term), `yearSummaries`.
- `portfolio/dividends.ts` — `missingDividends` from per-share events and units held before the ex-date.
- `portfolio/contracts.ts` — NSE symbols (`parseNseSymbol`, monthly and weekly), `monthlyExpiry`, `intrinsicValue`, `underlyingYahooSymbol`.

## Import

- `import/csv.ts` — RFC 4180 parse and write (formulas defused on export).
- `import/formats.ts` — `parseImport` for CapTrack exports, Zerodha tradebooks (IST, `.NS`/`.BO`, F&O contracts) and generic CSVs (columns found by common names); `exportCsv`.

## History and returns

- `portfolio/history.ts` — `buildHistory()` replays trades over daily closes + FX into `{date, value, costBasis, invested, benchmark?, partial}` per day in the base currency. `invested` is net money put in; the benchmark buys the index with each trade's money.
- `portfolio/xirr.ts` — `xirr(flows)` by bisection; returns a ratio (0.12 = 12%) or `undefined`.

## Splits

- `portfolio/splits.ts` — `Split {date, ratio}`. `replay(…, { splits })` and `buildHistory(…, { splits })` multiply open lots at each split date (total cost unchanged). `unadjustForSplits()` restores actually-traded prices when Yahoo split-adjusts its history; `detectImpliedSplits()` finds unreported splits from exact 1/n jumps (n ≥ 5).

## FX

- `fx/rates.ts` — Rates are stored as USD per 1 unit; `makeFxLookup(rows)` converts any pair through USD using the latest rate on or before the date. `normalizeCurrency()` maps minor units (GBp, ZAc, ILA) to major units.

## Testing

Tests live in `portfolio/__tests__/`, `import/__tests__/` and `fx/__tests__/` (Vitest).

```bash
npx vitest run src/lib/domain
```

When modifying position logic, always run this test file. Add test cases for any new edge cases.
