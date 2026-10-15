# CapTrack P&L Calculation Methodology

## Cost Basis Method
Average cost method. Each BUY increases cost basis by (quantity × price + fees).
Each SELL reduces cost basis by (soldQuantity × currentAvgCost) and books realized P&L of
(soldQuantity × price − sellFees − soldQuantity × currentAvgCost).

## Currencies
- Every trade keeps its own currency. Totals are shown in the user's base currency (any ISO 4217 code).
- Cost basis and realized P&L convert at the rate on the trade date; current value converts at today's rate.
- Rates are stored as USD per unit (ECB via Frankfurter, Yahoo for other currencies); any pair goes through USD.
  Weekends and holidays use the last published rate.
- A trade can carry the broker's own rate (`fx_rate` in `fx_quote`), which wins when it quotes the base currency.
- Quotes in minor units (GBp, ZAc, ILA) are converted to the major unit.

## Splits
- Holdings before a split date are multiplied by the ratio and average cost divided by it; total cost is unchanged.
- Splits come from Yahoo split events. Unreported splits are detected from a one-day price change of 1/n (n ≥ 5).
- History replay undoes Yahoo's split adjustment so past values use the prices actually traded.

## Returns
- Unrealized = current value − cost basis of open holdings (base currency).
- XIRR solves for the annual rate over every buy (outflow), sell (inflow) and today's value.
- The chart replays trades day by day over daily closes and daily FX.

## Assumptions
- Trades are processed in ascending chronological order
- All trades for the same asset are matched by symbol + asset type
- Holdings without a live price or rate are listed as missing and left out of value, never silently dropped

## Known Limitations
- No dividends, interest or mergers
- No FIFO or specific lot identification — average cost only
- Short selling not supported; oversized sells are clamped to available quantity

## Validation Test Coverage
Vitest suites in `src/lib/domain/**/__tests__` and `src/lib/__tests__`: positions, realized P&L,
base-currency conversion, FX lookup, minor units, splits, history replay, XIRR, and number formatting.
