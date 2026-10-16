# CapTrack P&L Calculation Methodology

## Lots and cost
- Every buy opens a lot (quantity, cost per unit with fees, date) on its platform. Lots never move between platforms.
- **FIFO (default):** a sell closes the oldest lots on that platform first. Realized P&L per lot =
  units × (sell price − sell fees per unit − lot cost per unit).
- **Average cost (setting):** every open lot carries the pooled average cost, so profit matches average-cost
  accounting; lot dates still close oldest first, for holding periods.
- Stocks, ETFs, funds and crypto can't go short. A sell larger than what was held is rejected when entered; in
  imported data the excess is ignored and flagged as "missing buys".

## Futures and options (NSE)
- Quantity and price are per unit (lots × lot size). Selling with nothing to close opens a short lot.
- Open contracts are valued at NSE's daily settlement price from the F&O bhavcopy (end of day, no live prices).
- Expired contracts close on their expiry date at NSE's final settlement: futures at the settlement price, options at
  intrinsic value against the underlying's settlement price. If NSE's file isn't available, the underlying's close
  from Yahoo is used.
- Futures have no value of their own: value and cash moved are their profit or loss. Option premiums are paid and
  received like any purchase.

## Currencies
- Every trade keeps its own currency. Totals are shown in the user's base currency (any ISO 4217 code).
- Cost converts at the rate on the buy date, sale proceeds at the rate on the sale date, current value at today's rate.
- Rates are stored as USD per unit (ECB via Frankfurter, Yahoo for other currencies); any pair goes through USD.
  Weekends and holidays use the last published rate.
- A trade can carry the broker's own rate (`fx_rate` in `fx_quote`), which wins when it quotes the base currency.
- Quotes in minor units (GBp, ZAc, ILA) are converted to the major unit.

## Splits
- Lots open before a split date are multiplied by the ratio and their unit cost divided by it; total cost is unchanged.
- Splits come from Yahoo split events. Unreported splits are detected from a one-day price change of 1/n (n ≥ 5).
- History replay undoes Yahoo's split adjustment so past values use the prices actually traded.

## Money in and out
- Put in = everything paid for buys (fees included). Taken out = everything received from sells (after fees),
  option settlements and futures profits.
- Net invested = put in − taken out. Selling at a profit lowers it by the full proceeds, so value − net invested
  is the total gain and never "disappears" when you sell.
- Cash per platform is tracked only for platforms with deposits or withdrawals logged:
  deposits − withdrawals ± trades (in the currency that actually left the account) + dividends + interest − charges.

## Returns
- Unrealized = current value − cost of open lots. Realized = sum of closed lot slices.
- Total return = unrealized + realized + dividends + interest − standalone charges. Its % is over money put in.
- XIRR solves for the annual rate over every buy (outflow), sell, dividend and interest (inflows), charges (outflow)
  and today's value. Deposits and cash balances are not returns and are left out.
- Benchmark: every buy also buys the index with the same money and every sell sells the same amount of it; the
  benchmark line, value and XIRR come from that.
- The chart replays trades day by day over daily closes and daily FX.

## Tax years and holding periods
- Sales group by tax year (start month is a setting: January, April for India, …).
- A lot sold after more than N months (setting, default 12) is long-term; futures, options and shorts are always
  short-term. One sale spanning both is split into two lines.
- Not tax advice: no rates, exemptions or grandfathering.

## Dividends
- Logged dividends count as income. Reported dividends (Yahoo, per share as paid) times units held the day before
  the ex-date are shown as "not logged" until a dividend for that symbol and platform is logged within 7 days before
  to 75 days after the ex-date.

## Assumptions
- Trades are processed in ascending chronological order
- All trades for the same asset are matched by symbol + asset type
- Holdings without a price or rate are listed as missing and left out of value, never silently dropped
- "Other" assets are valued at their last trade price

## Known Limitations
- No mergers, bonus issues or rights issues (NSE doesn't publish them in a structured form for free)
- No specific-lot selection; FIFO or average only
- No live NSE F&O prices; marks are end of day

## Validation Test Coverage
Vitest suites in `src/lib/**/__tests__`: lots (FIFO and average), platforms, oversells, shorts, expiry settlement,
futures cash, money summary and cash balances, history and benchmark, splits, tax years and terms, dividends,
NSE symbols and bhavcopy parsing, CSV import/export, FX lookup, XIRR, and number formatting.
