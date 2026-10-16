# Database

Everything CapTrack stores lives in one Supabase project (Postgres + Auth). This folder is the source of
truth: `migrations/` builds the whole schema from nothing, in order, and every file is safe to run twice.

## Set up a new copy

**Hosted project (what production uses)**

1. Create a project at supabase.com. Note the project URL, the publishable key and the secret key
   (Settings → API Keys).
2. Apply the migrations, either way:
   - SQL editor: paste and run `001_init.sql`, `002_…`, `003_…`, `004_…`, `005_…` in order.
   - CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. Auth → URL configuration: Site URL = your app URL; add `<app URL>/auth/callback` to Redirect URLs.
   Google sign-in is optional: Auth → Providers → Google, with your Google OAuth client.
4. App environment (`.env.local`, and the same in Vercel):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   SUPABASE_SECRET_KEY=sb_secret_…        # server only: market data writes, nightly job, daily ping
   ```
5. GitHub → Settings → Secrets: `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for the nightly market data job
   (`.github/workflows/market-data.yml`).
6. Vercel: set `regions` in `vercel.json` to the region closest to your Supabase project (this repo uses
   `pdx1` for AWS us-west-2). Every page makes a few database round trips; the distance between them is most
   of the load time.

**Local (Docker required)**

```bash
npx supabase start            # Postgres, Auth and the API on :54321, with every migration applied
npx supabase status -o env    # URL and keys for .env.local
npx supabase db reset         # rebuild from the migrations
npm run e2e                   # browser tests against this local database
```

## Schema

**Per user** (row-level security: `auth.uid() = user_id`; signed-out visitors can't read anything)

| Table | What it holds |
|---|---|
| `trades` | One buy or sell: `occurred_at`, `asset_symbol`, `asset_type` (`stock`, `etf`, `mutual_fund`, `crypto`, `future`, `option`, `other`), `asset_name`, `side` (`BUY`/`SELL`), `quantity`, `price`, `fees`, `currency`, `platform`, `source` (`manual`/`import`/`adjustment`), `notes`, `fx_rate` + `fx_quote` (the broker's own conversion rate), `external_id` (broker trade id; unique per user, used to skip re-imports), and for NSE futures/options `underlying`, `expiry`, `strike`, `option_type` (`CE`/`PE`), `lot_size`. Quantity and price are per unit, so 2 lots of 65 is quantity 130. |
| `cash_entries` | Money that isn't a trade: `kind` (`deposit`, `withdrawal`, `dividend`, `interest`, `fee`), positive `amount`, `currency`, `platform`, `asset_symbol`/`asset_type` (which holding paid a dividend), `notes`, `external_id`. |
| `user_settings` | `base_currency`, `platforms[]`, `cost_method` (`fifo`/`average`), `fy_start_month` (1–12), `long_term_months`, `benchmark` (a Yahoo symbol such as `^NSEI`). One row per user, created by a trigger at sign-up. |
| `activity` (view) | Trades and cash entries in one list for the activity log. `security_invoker`, so each table's RLS applies. |

**Shared market data** (any signed-in user reads; only the secret key writes)

| Table | What it holds |
|---|---|
| `price_history` | Daily close per `symbol` and `date`, with `currency`. `symbol` is a Yahoo symbol (`AAPL`, `INFY.NS`, `BTC-USD`, `^NSEI`), `MF:<AMFI scheme code>` for Indian funds, or `NFO:<NSE symbol>` for futures and options (their daily settlement price). |
| `price_splits` | Splits and bonus issues from Yahoo: `ratio` = new units per old unit. |
| `price_dividends` | Dividends per share from Yahoo, by ex-date. |
| `fx_rates` | USD per 1 unit of each currency per day (ECB, Yahoo for the rest). |

**Functions and triggers**

- `market_data(symbols, currencies, since)` returns closes, splits, dividends and FX in one JSON value, so a page
  loads all its market data in one round trip.
- `create_user_settings()` runs after every new `auth.users` row and inserts that user's settings.

How the app turns these rows into positions and returns: [`METHODOLOGY.md`](../METHODOLOGY.md).

## Migrations

| File | Adds |
|---|---|
| `001_init.sql` | `trades` and `user_settings` with RLS |
| `002_multi_currency_market_data.sql` | any ISO currency, per-trade broker rate, `fx_rates`, `price_history` |
| `003_price_splits.sql` | `price_splits` |
| `004_ledger.sql` | F&O columns, `external_id`, `cash_entries`, `activity`, settings columns, sign-up trigger, `price_dividends`, `market_data()` |
| `005_grants.sql` | explicit privileges per role (newer projects don't grant table access to the API roles by default) |

Adding one: a new numbered file, written to be safe to run twice (`IF NOT EXISTS`, `CREATE OR REPLACE`, guarded
`DO` blocks); apply it to production before deploying code that needs it; update the tables above.

The production project was set up by hand before this folder existed, so the CLI doesn't know what's applied. To
switch it to `db push`, mark the existing files as done once:
`npx supabase migration repair --status applied 001 002 003 004 005`.

Production also has two unused tables from an early import prototype, `import_jobs` and `import_rows_staging`.
Nothing reads them; they can be dropped.
