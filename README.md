# CapTrack

CapTrack is a multi-platform portfolio tracking application that allows users to track trades, positions, and profit & loss (P&L) across different brokers and base currencies using live market data.

## Features

- Secure authentication with Email/Password and Google OAuth
- Portfolio and trade tracking across multiple platforms
- Real-time unrealized P&L and **Today’s P&L**
- Multi-currency support with automatic FX conversion
- Position-level and portfolio-level analytics
- Mobile-responsive UI with compact summaries
- Database-enforced multi-tenancy using Row Level Security (RLS)

## Tech Stack

**Frontend**
- Next.js (App Router)
- React Server Components
- Tailwind CSS

**Backend & Data**
- Supabase (PostgreSQL + Auth)
- Supabase Row Level Security (RLS)

**Market Data**
- Yahoo Finance (price data)
- FX rate conversion for base currency normalization

**Authentication**
- Supabase Auth
- Google OAuth (account picker enforced)

## Architecture Overview

CapTrack follows a server-first architecture with strict database-level access control.

- Authentication is handled by Supabase Auth.
- Authorization is enforced using PostgreSQL Row Level Security (RLS).
- Each user owns their own data, scoped by `user_id` at the database level.
- No client-side filtering is relied upon for access control.

**Request Flow**

Browser → Next.js Server → Supabase (RLS) → PostgreSQL

## Security Model

- All user-facing tables are protected using Supabase Row Level Security (RLS).
- Users can only read or modify rows that belong to their own account.
- No service-role keys are used in application request paths.
- Authentication context is passed using secure HTTP-only cookies.

## Data Model (High Level)

- `auth.users` — Supabase-managed authenticated users
- `portfolios`
  - `id`, `user_id`, `name`
- `trades`
  - `id`, `portfolio_id`, trade metadata
- `user_settings`
  - `user_id`, `base_currency`, `platforms`

## User Bootstrapping

On first login, CapTrack automatically ensures:

- A default portfolio named `Main` exists for the user
- A user settings row exists with:
  - Base currency set to `USD`
  - Platform set to `Manual`

This guarantees the application is always in a valid state for new users.

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project

### Environment Variables

Create a `.env.local` file with the following values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Install and Run

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

## License

MIT License
