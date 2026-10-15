# External Services

## Yahoo Finance (`prices/yahoo.ts`)

Unofficial public `/v8/finance/chart` endpoint, no key. Every caller must handle failures.

- **`fetchYahooPrices(inputs)`** — Latest quotes in parallel, fails soft (returns only successes). Prices are in major units: `GBp` pence become `GBP`. Includes `intraday` closes for sparklines.
- **`fetchDailyHistory(symbol, type, from)`** — Daily closes since `from`, keyed by the exchange's local date.
- **`fetchYahooUsdRate` / `fetchYahooUsdRateHistory`** — FX fallback for currencies the ECB doesn't publish.
- **`toYahooSymbol(symbol, assetType)`** — Crypto gets `-USD` (BTC → BTC-USD).
- Symbol search lives in `src/app/api/symbols/route.ts`; single quotes for the trade form in `src/app/api/quote/route.ts`.

## FX (`fx/frankfurter.ts`)

ECB reference rates via Frankfurter (free, no key, past values never change). About 30 currencies; everything else falls back to Yahoo.

## Market data store (`market/store.ts`)

Supabase tables shared by all users (see `supabase/migrations/002_*`):
- `fx_rates(date, currency, usd_per_unit)` and `price_history(symbol, date, close, currency)`.
- Signed-in users can read; only the service role writes (`src/lib/supabase/service.ts`, needs `SUPABASE_SERVICE_ROLE_KEY`).
- **`loadUsdRates(supabase, currencies, from)`** and **`loadPriceHistory(supabase, assets)`** read the tables, fetch only missing or stale ranges, and write them back when the service key is set. Without the key they still return fetched data for the request.
- `scripts/refresh-market-data.ts` runs the same loaders nightly from `.github/workflows/market-data.yml`.

## Caching

- Quotes: Next fetch cache 60s. Daily history and FX ranges: 1h. Symbol search: 5 min.
