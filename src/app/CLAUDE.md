# Routes & Pages

## Route Groups

- `(app)/` — Protected pages. The layout (`layout.tsx`) calls `getUser()` and redirects to `/login` if unauthenticated. All pages inside inherit this guard.
- `(auth)/` — Public auth pages (login, signup, forgot-password, reset-password). No auth check.
- `api/symbols/` — GET proxy to Yahoo Finance symbol search (Indian fund codes from mfapi.in when `type=mutual_fund`). No auth required.
- `api/contracts/` — NSE futures and options matching typed words, from the latest bhavcopy. Signed in only.
- `api/export/` — CSV of every trade and cash entry (re-importable), or `?what=sales&year=` for a tax year's sales.
- `auth/callback/` and `auth/logout/` — Supabase OAuth callback and session logout handlers.

## Page Patterns

- All protected pages use `export const dynamic = 'force-dynamic'` (auth cookies).
- Pages are **Server Components**. They fetch data via `supabaseServer()` and pass props to client components.
- Auth guard: `const user = await getUser(); if (!user) redirect('/login');`. `getUser()` verifies the session JWT locally (no Auth round trip) and is cached per request, as is `supabaseServer()`.
- `user_settings` rows are created by a database trigger at sign-up; `readSettings()` falls back to defaults.
- Add/edit panels open from the URL on any page: render `<EntrySheets basePath searchParams />` and link with `sheetHref()` from `@/lib/sheet-links` (`?trade=new|<id>`, `?cash=new|<id>`, prefills as `f_symbol`, `f_side`, …). `closeHref()` drops them.

## Server Actions

- `(app)/trades/actions.ts` — `saveTradeAction` (create/edit, Zod, rejects a stock sell larger than what was held on that platform that day, adds a new platform to settings, redirects to `returnTo`), `deleteTradeAction`, `saveCashAction`, `deleteCashAction`, `deleteEntriesAction` (bulk), `importAction` (re-validates previewed CSV rows and skips ones already saved by broker id or by date/symbol/side/qty/price/platform). Forms send `occurredAt` as an ISO timestamp built in the browser so time zones are right.
- `(app)/settings/actions.ts` — base currency, returns and tax (cost method, tax year, long-term months, benchmark), platforms (renames update trades and cash), display name, first-run setup, delete all activity. Return `{ ok, message }` for inline status.
- `user_id` always comes from the server session, never from form data. `returnTo` only accepts same-site paths.

## Pages

- `/dashboard` — summary strip, value vs net invested chart (with benchmark), allocation, holdings, money in and out.
- `/holdings` — sortable holdings with a Sell per row, F&O, cash per platform, closed positions. `/holdings/[symbol]?type=` is one holding: price chart with trades marked, lots, trades, sales, dividends.
- `/trades` — the Activity log: trades and cash entries (50 per page, filters in the URL), bulk delete. `/trades/import` previews and imports CSVs.
- `/pnl` — realized sales by tax year (short/long term, F&O apart), income and charges, dividends not logged.

## Portfolio Data Flow

`loadPortfolio(supabase, platform, withHistory)` in `src/lib/portfolio.ts` (cached per request; `getPortfolio` returns just the snapshot):
1. Settings, every trade and every cash entry in parallel (RLS scopes to the user) — `loadLedger`
2. In parallel: live quotes for open positions (`fetchQuotes`: Yahoo, mfapi NAVs) and `loadMarket` (one `market_data` RPC for closes, splits, dividends, FX and the benchmark; missing series fetched now, stale ones refreshed after the response)
3. `assemble()` (pure): `replay()` lots per platform with the cost method, splits and expiry settlement; holdings, F&O, cash, money summary, allocation, history, XIRR, benchmark, sales and dividend suggestions. Anything without a price or rate is listed in `missingQuotes` / `missingFx`, never silently dropped
