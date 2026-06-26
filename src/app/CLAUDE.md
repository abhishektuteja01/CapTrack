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

1. Fetch all trades for `user.id`
2. Filter by platform query param if present
3. `derivePositions()` calculates holdings (pure function)
4. `fetchYahooPrices()` gets live quotes
5. FX conversion to base currency (USD or INR) via `getUsdInrRateCached()`
6. Render totals and per-position P&L in base currency
