# Data Layer (src/lib)

## Supabase Clients

- `supabase/server.ts` — Server-side client using SSR cookies, one per request (React `cache`). Use in Server Components and Server Actions.
- `supabase/browser.ts` — Client-side singleton. Use in `'use client'` components.
- `supabase/auth.ts` — `getUser()` returns `{ id, email, user_metadata }` or `null` from `getClaims()` (JWT verified locally against the project's signing keys), cached per request. `displayName()` for the UI.

## Repository

- `repo/tradesRepo.ts` — `upsertTrade`, `upsertCash`, `deleteRows(table, ids, userId)`, `insertMany(table, userId, rows)` (batches of 500). Every query also filters by `user_id` (defense in depth with RLS).
- Returns `{ ok: true } | { ok: false; message: string }` — never throws.

## Validators

- `validators/trade.ts` — `tradeSchema` (uppercases symbol/currency, trims, defaults fees to 0; futures and options need a `contract`) and `cashSchema` (dividends need a symbol). `TradeInput`, `CashInput`.

## Types

- `types/trades.ts` — Core type definitions: `AssetType`, `TradeSide`, `Trade`, `NewTrade`, `TradeSource`, `CurrencyCode`, `AssetRef`.

## Portfolio

- `portfolio.ts` — `loadLedger` (settings, trades, cash), `loadPortfolio`/`getPortfolio` and the pure `assemble()` that builds the snapshot (holdings, F&O, closed, cash, totals, money, allocation, history, XIRR, benchmark) plus sales and dividend suggestions. `example-portfolio.ts` feeds `assemble()` made-up data for the landing page. See `src/app/CLAUDE.md`.
- `trades.ts` — activity list (`listActivity` on the `activity` view), `loadTrade`, `loadCash`, `openAccounts` (open lots per platform, for the sell helper).
- `sheet-links.ts` — `sheetHref`, `closeHref`, `holdingHref`. `benchmarks.ts`, `labels.ts` — display names.
- `settings.ts` — `normalizePlatforms()`, `isoCurrencies()`, and zod schemas for base currency and platforms.
- `supabase/service.ts` — service-role client for shared market data writes. Server only; `null` without `SUPABASE_SECRET_KEY`.

## Utilities

- `utils.ts` — `cn()` combines `clsx` + `tailwind-merge` for conditional classNames.
- `format.ts` — every number in the UI: `money()` (locale per currency, ₹ uses Indian grouping), `moneyDelta()`, `pct()`, `qty()`, `price()`, `compactMoney()`. True minus sign, explicit +, "—" for unknown. Don't write local formatters.

## Key Conventions

- Data functions return `{ ok, message? }` result objects — no throwing.
- All DB writes go through `tradesRepo` after Zod validation.
- `user_id` always comes from server-side `getUser()`, never from client input.
