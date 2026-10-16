# External Services

## Yahoo Finance (`prices/yahoo.ts`)

Unofficial public `/v8/finance/chart` endpoint, no key. Every caller must handle failures.

- **`fetchYahooPrices(inputs)`** — Latest quotes in parallel, fails soft (returns only successes). Prices are in major units: `GBp` pence become `GBP`. Includes `intraday` closes for sparklines.
- **`fetchDailyHistory(symbol, type, from)`** — Daily closes, splits and dividends (per share) since `from`, keyed by the exchange's local date.
- Falls back to the `query2` host on 429/5xx. Sparklines are thinned to ~80 points.
- **`fetchYahooUsdRate` / `fetchYahooUsdRateHistory`** — FX fallback for currencies the ECB doesn't publish.
- **`toYahooSymbol(symbol, assetType)`** — Crypto gets `-USD` (BTC → BTC-USD).
- Symbol search lives in `src/app/api/symbols/route.ts`; single quotes for the trade form in `src/app/api/quote/route.ts`.

## Indian mutual funds (`prices/mfapi.ts`)

mfapi.in (free, no key; mirrors AMFI). A fund's symbol is its AMFI scheme code (5–6 digits). `fetchMfHistory`, `fetchMfLatest`, `searchMf`.

## NSE futures and options (`prices/nse.ts`)

Daily F&O bhavcopy from nsearchives.nseindia.com (zip, ~1.2 MB, no cookies; published ~6 pm IST). `fetchFoBhavcopy(date)` / `latestFoBhavcopy()` parse every contract's close, settlement price, lot size and underlying. On expiry day NSE lists the underlying's price as an option's settlement; the parser turns it into intrinsic value. No live F&O prices exist for free.

## Quotes (`prices/quotes.ts`)

`fetchQuotes(ids)` — live Yahoo quotes and latest NAVs for open holdings, keyed by asset key. NSE contracts use their stored settlement prices instead.

## FX (`fx/frankfurter.ts`)

ECB reference rates via Frankfurter (free, no key, past values never change). About 30 currencies; everything else falls back to Yahoo.

## Market data store (`market/store.ts`)

Supabase tables shared by all users (`fx_rates`, `price_history`, `price_splits`, `price_dividends`):
- Signed-in users can read; only the service role writes (`src/lib/supabase/service.ts`, needs `SUPABASE_SECRET_KEY`).
- `sourceId(symbol, type)` — what `price_history.symbol` holds: Yahoo symbol, `MF:<code>` or `NFO:<symbol>`; `undefined` for `other`.
- **`loadMarket(supabase, { assets, currencies, since, benchmark })`** — one `market_data` RPC, then: series with no rows are fetched before returning; stale ones (older than the last weekday) are refreshed after the response with `after()`, at most once per 15 minutes per server instance; new NSE contracts get the latest bhavcopy now and up to ~3 months of daily settlements in the background. Expired contracts also load their underlying's closes for settlement.
- `loadFx`, `loadSplits` (one query, for the sell checks), `refreshSeries`, `refreshContracts`, `refreshFx`.
- `scripts/refresh-market-data.ts` runs `loadMarket` for every asset, currency and benchmark in use nightly from `.github/workflows/market-data.yml`, awaiting every refresh.

## Caching

- Quotes: Next fetch cache 60s. Daily history and FX ranges: 1h. NAVs: 30 min–1h. Symbol search: 5 min. Bhavcopies: in memory per server instance.
