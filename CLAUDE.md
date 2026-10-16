# CLAUDE.md

Root guidance for Claude Code. Section-specific guidance lives in nested CLAUDE.md files — Claude Code auto-loads the nearest one.

## Commands

```bash
npm run dev      # Dev server at http://localhost:3000
npm run build    # Production build (catches type errors)
npm run lint     # ESLint
npm run test     # Vitest unit tests
npx vitest run <path>  # Run a single test file
npx supabase start     # Local database with every migration (Docker)
npm run e2e      # Playwright browser tests against the local database
```

## Git

- Never add AI attribution to commits, pushes or PRs: no `Co-Authored-By: Claude` trailers, no "Generated with Claude Code" lines.
- `main` is protected: changes go through a PR, and the `checks` CI job (lint, typecheck, tests, build) must pass. The `e2e` job runs the Playwright suite against a local Supabase.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   # falls back to legacy NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY                    # server only; writes shared market data. Falls back to SUPABASE_SERVICE_ROLE_KEY
```

## High-Level Architecture

Next.js 16 App Router + Supabase (auth + PostgreSQL) + Tailwind CSS 4.

```
Browser → middleware (session refresh) → Server Components → Supabase RLS → PostgreSQL
```

Security is enforced at the DB layer via RLS — `auth.uid() = user_id` on all tables.

## Section Guides

| Path | Scope |
|------|-------|
| `src/app/CLAUDE.md` | Routes, pages, server actions, auth guards |
| `src/components/CLAUDE.md` | UI components, client components, forms |
| `src/lib/CLAUDE.md` | Data layer, portfolio assembly, repo, validators, utilities |
| `src/lib/domain/CLAUDE.md` | Pure business logic: lots, money, tax, F&O, CSV import, tests |
| `src/lib/services/CLAUDE.md` | External data (Yahoo, mfapi, NSE, ECB), market data store, caching |

## Data Models

- `trades` — id, user_id, asset metadata (types: stock, etf, mutual_fund, crypto, future, option, other), side, quantity, price, fees, currency (any ISO code), fx_rate/fx_quote (optional broker rate), platform, source, notes, external_id (import dedupe), underlying/expiry/strike/option_type/lot_size (NSE F&O)
- `cash_entries` — deposits, withdrawals, dividends, interest and charges per platform
- `activity` — view: trades and cash entries in one list (security_invoker, so RLS applies)
- `user_settings` — base_currency, platforms[], cost_method (fifo|average), fy_start_month, long_term_months, benchmark. Created by a trigger at sign-up
- `fx_rates`, `price_history`, `price_splits`, `price_dividends` — shared daily market data, read by users (one round trip via the `market_data` RPC), written by the service role. `price_history.symbol` is a Yahoo symbol, `MF:<AMFI code>` or `NFO:<NSE symbol>`

Full schema, setup for a new copy, and how to add a migration: `supabase/README.md`. Migrations live in `supabase/migrations/` (001 → 005, each safe to run twice); run new ones in the Supabase SQL editor before deploying code that needs them. Newer Supabase projects grant nothing by default, so new tables need explicit `GRANT`s (see `005_grants.sql`).

## Deploy

`vercel.json` pins functions to `pdx1`, next to the Supabase project (AWS us-west-2). Every page makes a few database round trips, so the region matters more than anything else for speed.
