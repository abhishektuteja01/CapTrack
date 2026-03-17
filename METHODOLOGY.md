# CapTrack P&L Calculation Methodology

## Cost Basis Method
Average cost method. Each BUY increases cost basis by (quantity × price + fees).
Each SELL reduces cost basis by (soldQuantity × currentAvgCost). Fees on sells
are tracked separately and do not affect cost basis reduction.

## Assumptions
- Trades are processed in ascending chronological order
- All trades for the same asset are matched by symbol + asset type
- Currency is recorded per position but no cross-currency conversion is performed
- Fees are included in cost basis on BUY, tracked separately on SELL

## Known Limitations
- No multi-currency P&L conversion (USD-only portfolios recommended)
- No corporate action handling (splits, dividends, mergers)
- No FIFO or specific lot identification — average cost only
- Short selling not supported; oversized sells are clamped to available quantity

## Validation Test Coverage
Six unit tests covering:
1. Simple BUY — quantity, costBasis, avgCost, fees
2. Partial SELL — correct cost basis reduction using avgCost
3. Full SELL — position removed from results
4. Oversized SELL — clamped to zero, no negative quantity
5. Multiple BUYs — correct average cost calculation
6. Fee accumulation — totalFees across buy and sell trades