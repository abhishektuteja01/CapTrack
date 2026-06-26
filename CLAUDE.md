# CLAUDE.md

Root guidance for Claude Code. Section-specific guidance lives in nested CLAUDE.md files — Claude Code auto-loads the nearest one.

## Commands

```bash
npm run dev      # Dev server at http://localhost:3000
npm run build    # Production build (catches type errors)
npm run lint     # ESLint
npm run test     # Vitest unit tests
npx vitest run <path>  # Run a single test file
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
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
| `src/lib/CLAUDE.md` | Data layer, repo, validators, bootstrap, utilities |
| `src/lib/domain/CLAUDE.md` | Pure business logic, position derivation, tests |
| `src/lib/services/CLAUDE.md` | External APIs (Yahoo Finance), caching, FX |

## Data Models

- `trades` — id, user_id, asset metadata, quantity, price, fees, currency, platform, source, notes
- `user_settings` — user_id, base_currency (USD/INR), platforms[]
