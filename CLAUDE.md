# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js dev server (http://localhost:3000)
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
npm run test     # Run Vitest unit tests
```

To run a single test file:
```bash
npx vitest run src/lib/domain/portfolio/__tests__/positions.test.ts
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Architecture

**CapTrack** is a portfolio/trade tracker built with Next.js 15 App Router, Supabase (auth + PostgreSQL), and Tailwind CSS 4.

### Request Flow

```
Browser → Next.js middleware (proxy.ts, session refresh) → Server Components → Supabase RLS → PostgreSQL
```

Security is enforced at the database layer via PostgreSQL Row Level Security — all user tables have RLS enabled so users can only access their own data.

### Route Groups

- `src/app/(auth)/` — Public auth pages (login, signup, forgot/reset password)
- `src/app/(app)/` — Protected pages; server components call `getUser()` and redirect to login if unauthenticated
- `src/app/api/symbols/` — Symbol search proxy to Yahoo Finance
- `src/app/auth/callback/` and `auth/logout/` — Supabase OAuth callback and logout handlers

### Data Layer

- **`src/lib/supabase/server.ts`** — Server-side Supabase client (SSR cookies)
- **`src/lib/supabase/browser.ts`** — Client-side Supabase client
- **`src/lib/supabase/auth.ts`** — `getUser()` helper used in server components
- **`src/lib/repo/tradesRepo.ts`** — Database operations for trades (upsert/delete)
- **`src/lib/validators/trade.ts`** — Zod schemas; validation happens before all DB writes
- **`src/lib/bootstrap.ts`** — Creates user_settings on first login

### Domain Logic

Pure business logic lives in `src/lib/domain/` with no framework or database dependencies:
- `portfolio/positions.ts` — `derivePositions()` calculates holdings via average-cost method from raw trades

Tests are colocated in `__tests__/` subdirectories and use Vitest.

### External Services

- **Yahoo Finance** — prices (stocks, ETFs, crypto, FX) and symbol search. No auth required. Results are cached in-memory (5 min for symbols, 1 min for prices, 1 hour for USD/INR FX).
- **Supabase Auth** — email/password + Google OAuth

### Key Patterns

- **Server Components by default**; add `'use client'` only for interactivity. Pages use `export const dynamic = 'force-dynamic'` since they depend on auth cookies.
- **Error handling**: data functions return `{ ok: boolean, message?: string }` rather than throwing.
- **`cn()` utility** (`src/lib/utils.ts`) combines `clsx` + `tailwind-merge` for conditional classNames.
- **Multi-currency**: trades store original currency; dashboard converts to base currency (USD or INR) using live FX rates from Yahoo Finance.
- **User bootstrapping**: handled in `bootstrap.ts` — safe to call multiple times (upsert semantics).

### Data Models

- `trades` — id, user_id, asset metadata, quantity, price, fees, currency, platform, source, notes
- `user_settings` — user_id, base_currency (USD/INR), platforms[]
