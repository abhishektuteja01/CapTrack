# Routes & Pages

## Route Groups

- `(app)/` — Protected pages. The layout (`layout.tsx`) calls `getUser()` and redirects to `/login` if unauthenticated. All pages inside inherit this guard.
- `(auth)/` — Public auth pages (login, signup, forgot-password, reset-password). No auth check.
- `api/symbols/` — GET proxy to Yahoo Finance symbol search. No auth required.
- `auth/callback/` and `auth/logout/` — Supabase OAuth callback and session logout handlers.

## Page Patterns

- All protected pages use `export const dynamic = 'force-dynamic'` (auth cookies).
- Pages are **Server Components**. They fetch data via `supabaseServer()` and pass props to client components.
- Auth guard: `const user = await getUser(); if (!user) redirect('/login');`
- Dashboard calls `ensureUserBootstrap(user.id)` on load to seed `user_settings` for new users.

## Server Actions

Server actions live in `(app)/trades/actions.ts`:
- `createTradeAction` — validates with Zod, calls `upsertTrade()`, revalidates `/trades` and `/dashboard`
- `deleteTradeAction` — calls `deleteTrade()`, revalidates both paths
- Both get `user_id` from `getUser()` server-side — **never from form data**

## Dashboard Data Flow

`getPortfolio(supabase, { platform?, withHistory? })` in `src/lib/portfolio.ts` does all of it:
1. Load settings and every trade (RLS scopes to the user)
2. Live quotes for open positions (`fetchYahooPrices`)
3. FX for every currency involved, from the first trade to today (`loadUsdRates`)
4. `derivePositions()` with base currency: cost basis and realized P&L at trade-date FX
5. Value at today's rate; holdings without a quote or rate are listed in `missingQuotes` / `missingFx`, never silently dropped
6. Allocation, daily history (`buildHistory`) and XIRR
