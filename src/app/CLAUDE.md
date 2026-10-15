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

- `(app)/trades/actions.ts` — `saveTradeAction` (create/edit, Zod, adds a new platform to settings, redirects to `returnTo`), `deleteTradeAction`. The form sends `occurredAt` as an ISO timestamp built in the browser so time zones are right.
- `(app)/settings/actions.ts` — base currency, platforms (renames update trades), display name, and first-run setup. Return `{ ok, message }` for inline status.
- `user_id` always comes from the server session, never from form data. `returnTo` only accepts same-site paths.

## Trades UI

`/trades` lists trades (50 per page, filters in the URL). `?new=1` and `?edit=<id>` open the side panel; `/trades/new?from=…` and `/trades/[id]/edit` are full-page fallbacks.

## Dashboard Data Flow

`getPortfolio(supabase, { platform?, withHistory? })` in `src/lib/portfolio.ts` does all of it:
1. Load settings and every trade (RLS scopes to the user)
2. Live quotes for open positions (`fetchYahooPrices`)
3. FX for every currency involved, from the first trade to today (`loadUsdRates`)
4. `derivePositions()` with base currency: cost basis and realized P&L at trade-date FX
5. Splits (Yahoo events + detected 1/n price jumps) adjust quantities and avg cost; value at today's rate; holdings without a quote or rate are listed in `missingQuotes` / `missingFx`, never silently dropped
6. Allocation, daily history (`buildHistory`) and XIRR
