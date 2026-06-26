# External Services

## Yahoo Finance (`prices/yahoo.ts`)

Fetches live prices from Yahoo Finance's public `/v8/finance/chart` endpoint. No API key required.

### Key Exports

- **`fetchYahooPrices(inputs)`** — Fetches quotes for multiple symbols in parallel. Each input has `{ symbol, assetType }`. Returns `YahooQuote[]` with price, currency, previousClose, dayChangePercent.
- **`toYahooSymbol(symbol, assetType)`** — Maps internal symbols to Yahoo format. Crypto gets `-USD` suffix (BTC → BTC-USD). Stocks/ETFs pass through as-is.
- **`getUsdInrRateCached()`** — Returns cached USD/INR exchange rate. 1-hour TTL to avoid rate jitter on serverless.

### Caching (in-memory)

- Symbol search results: 5 minutes
- Price quotes: 1 minute
- USD/INR FX rate: 1 hour

### Asset Type Handling

- **Stocks/ETFs**: 1-minute interval, 1-day range
- **Crypto**: Uses `BTC-USD` format
- **FX**: 1-day interval, 5-day range (for reliability)

### Error Handling

- Functions throw `YahooPriceError` on fetch failures.
- Dashboard catches these and shows positions without LTP (graceful degradation).
- Individual symbol failures don't block other symbols — each is fetched independently.
