# Data Layer (src/lib)

## Supabase Clients

- `supabase/server.ts` — Server-side client using SSR cookies. Use in Server Components and Server Actions.
- `supabase/browser.ts` — Client-side singleton. Use in `'use client'` components.
- `supabase/auth.ts` — `getUser()` returns the authenticated user or `null`. Calls `supabase.auth.getUser()` server-side.

## Repository

- `repo/tradesRepo.ts` — Two functions:
  - `upsertTrade({ tradeId?, userId, payload })` — Insert or update. Filters by `user_id` (defense-in-depth with RLS).
  - `deleteTrade({ tradeId, userId })` — Delete with `user_id` guard.
- Returns `{ ok: true } | { ok: false; message: string }` — never throws.

## Validators

- `validators/trade.ts` — Zod schema (`tradeSchema`) for trade input. Validates and transforms (uppercases symbol/currency, trims strings, defaults fees to 0).
- Inferred type: `TradeInput = z.infer<typeof tradeSchema>`

## Types

- `types/trades.ts` — Core type definitions: `AssetType`, `TradeSide`, `Trade`, `NewTrade`, `TradeSource`, `CurrencyCode`, `AssetRef`.

## Bootstrap

- `bootstrap.ts` — `ensureUserBootstrap(userId)` ensures a `user_settings` row exists with defaults (USD base currency, Manual platform). Safe to call multiple times (upsert semantics). Called on dashboard load.

## Utilities

- `utils.ts` — `cn()` combines `clsx` + `tailwind-merge` for conditional classNames.

## Key Conventions

- Data functions return `{ ok, message? }` result objects — no throwing.
- All DB writes go through `tradesRepo` after Zod validation.
- `user_id` always comes from server-side `getUser()`, never from client input.
