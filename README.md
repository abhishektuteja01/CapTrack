<p align="center">
  <img src="public/icons/icon-192.png" width="64" height="64" alt="CapTrack" />
</p>

<h1 align="center">CapTrack</h1>

<p align="center">
  <strong>The minimal way to track your capital.</strong><br />
  Beautifully simple portfolio tracking for modern investors.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss" alt="Tailwind CSS 4" />
</p>

---

## What it does

Track buy/sell trades across brokers, see real-time P&L in your base currency, and filter everything by platform. No clutter, no distractions.

**Real-time data** — Live prices for US stocks, Indian stocks, ETFs, and crypto via Yahoo Finance.
**Multi-currency** — Trade in USD or INR. Dashboard auto-converts to your base currency with live FX.
**Platform filtering** — Tag trades by broker (Zerodha, Robinhood, etc.) and slice your dashboard by platform.
**Secure by default** — Row Level Security at the database layer. Users can only access their own data.

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19, Tailwind CSS 4, Framer Motion |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Market data | Yahoo Finance (no API key needed) |
| Validation | Zod |
| Testing | Vitest |

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/abhishektuteja01/CapTrack.git
cd CapTrack
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials:
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# 3. Run
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest |

## Architecture

```
Browser  ->  Middleware (session refresh)  ->  Server Components  ->  Supabase RLS  ->  PostgreSQL
```

- **Server-first** — Pages are Server Components by default. `'use client'` only for interactivity.
- **Security at the DB layer** — Every table has RLS policies enforcing `auth.uid() = user_id`.
- **Pure domain logic** — Position derivation lives in `src/lib/domain/` with zero framework dependencies.

## Project structure

```
src/
  app/
    (app)/            Protected routes (dashboard, trades, settings)
    (auth)/           Public auth (login, signup, password reset)
    api/symbols/      Yahoo Finance symbol search proxy
    auth/             OAuth callback + logout
  components/
    trades/           Trade form, list, filters, delete
    layout/           App shell (header, user menu)
    ui/               Primitives (animations, backgrounds)
  lib/
    domain/           Pure business logic (position derivation)
    repo/             Database operations (trades CRUD)
    services/         External APIs (Yahoo Finance, FX)
    supabase/         Client setup + auth helpers
    validators/       Zod schemas
```

## Data model

| Table | Purpose |
|-------|---------|
| `trades` | Every buy/sell transaction — symbol, type, side, qty, price, fees, currency, platform |
| `user_settings` | Per-user preferences — base currency (USD/INR), platform list |

Both tables are scoped to `user_id` with RLS. No shared data, no admin tables.

## License

MIT
