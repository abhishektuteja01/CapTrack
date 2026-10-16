-- 004: F&O contracts, cash entries, import ids, settings for cost method and tax year,
-- dividends, a one-round-trip market data read, and settings created at sign-up.
-- Safe to run more than once. Run in the Supabase SQL editor before deploying the matching code.

-- 1. Trades: any of the supported asset types, NSE F&O contract fields, an id from the broker for imports.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid = 'public.trades'::regclass
      AND pg_get_constraintdef(c.oid) ~* 'asset_type'
  LOOP
    EXECUTE format('ALTER TABLE public.trades DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS underlying text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS expiry date;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS strike numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS option_type text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS lot_size numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_asset_type_known') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_asset_type_known
      CHECK (asset_type IN ('stock', 'etf', 'mutual_fund', 'crypto', 'future', 'option', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_derivative_valid') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_derivative_valid CHECK (
      (asset_type NOT IN ('future', 'option'))
      OR (expiry IS NOT NULL AND underlying IS NOT NULL
          AND (asset_type = 'future' OR (strike >= 0 AND option_type IN ('CE', 'PE'))))
    );
  END IF;
END $$;

-- Old 'cash' trades never had a price; they become 'other'.
UPDATE public.trades SET asset_type = 'other' WHERE asset_type = 'cash';

CREATE UNIQUE INDEX IF NOT EXISTS trades_user_external_id ON public.trades (user_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trades_user_occurred ON public.trades (user_id, occurred_at);

-- 2. Cash entries: deposits, withdrawals, dividends, interest and standalone charges, per platform.
CREATE TABLE IF NOT EXISTS public.cash_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deposit', 'withdrawal', 'dividend', 'interest', 'fee')),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  platform text NOT NULL DEFAULT 'Manual',
  asset_symbol text,
  asset_type text,
  notes text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'dividend' OR asset_symbol IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS cash_entries_user_occurred ON public.cash_entries (user_id, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS cash_entries_user_external_id ON public.cash_entries (user_id, external_id) WHERE external_id IS NOT NULL;

ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_entries own" ON public.cash_entries;
CREATE POLICY "cash_entries own" ON public.cash_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_entries TO authenticated;

-- 3. Activity: trades and cash entries in one list. security_invoker keeps each table's RLS.
CREATE OR REPLACE VIEW public.activity WITH (security_invoker = true) AS
  SELECT id, 'trade'::text AS entry, side AS kind, occurred_at, asset_symbol, asset_type, asset_name,
         quantity, price, fees, quantity * price + CASE WHEN side = 'BUY' THEN fees ELSE -fees END AS amount,
         currency::text AS currency, platform, notes, user_id
  FROM public.trades
  UNION ALL
  SELECT id, 'cash', kind, occurred_at, asset_symbol, asset_type, NULL,
         NULL, NULL, NULL, amount, currency, platform, notes, user_id
  FROM public.cash_entries;
GRANT SELECT ON public.activity TO authenticated;

-- 4. Settings: cost method, tax year start month, long-term threshold, benchmark.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS cost_method text NOT NULL DEFAULT 'fifo';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS fy_start_month smallint NOT NULL DEFAULT 1;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS long_term_months smallint NOT NULL DEFAULT 12;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS benchmark text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_values_valid') THEN
    ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_values_valid CHECK (
      cost_method IN ('fifo', 'average')
      AND fy_start_month BETWEEN 1 AND 12
      AND long_term_months BETWEEN 1 AND 60
    );
  END IF;
END $$;

-- 5. Settings row created at sign-up, so pages never have to check.
CREATE OR REPLACE FUNCTION public.create_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, base_currency, platforms)
  VALUES (NEW.id, 'USD', ARRAY['Manual'])
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_settings();

INSERT INTO public.user_settings (user_id, base_currency, platforms)
SELECT id, 'USD', ARRAY['Manual'] FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 6. Dividends per share reported by Yahoo, shared like splits.
CREATE TABLE IF NOT EXISTS public.price_dividends (
  symbol text NOT NULL,
  date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, date)
);
ALTER TABLE public.price_dividends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_dividends readable" ON public.price_dividends;
CREATE POLICY "price_dividends readable" ON public.price_dividends FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.price_dividends TO authenticated;

-- 7. Everything a portfolio needs from the shared market tables in one round trip.
-- Returns compact arrays: prices [symbol, date, close, currency], splits [symbol, date, ratio],
-- dividends [symbol, date, amount], fx [currency, date, usd_per_unit].
CREATE OR REPLACE FUNCTION public.market_data(p_symbols text[], p_currencies text[], p_since date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'prices', COALESCE((
      SELECT jsonb_agg(jsonb_build_array(symbol, date, close, currency) ORDER BY symbol, date)
      FROM public.price_history WHERE symbol = ANY (p_symbols) AND date >= p_since
    ), '[]'::jsonb),
    'splits', COALESCE((
      SELECT jsonb_agg(jsonb_build_array(symbol, date, ratio) ORDER BY symbol, date)
      FROM public.price_splits WHERE symbol = ANY (p_symbols)
    ), '[]'::jsonb),
    'dividends', COALESCE((
      SELECT jsonb_agg(jsonb_build_array(symbol, date, amount) ORDER BY symbol, date)
      FROM public.price_dividends WHERE symbol = ANY (p_symbols) AND date >= p_since
    ), '[]'::jsonb),
    'fx', COALESCE((
      SELECT jsonb_agg(jsonb_build_array(currency, date, usd_per_unit) ORDER BY currency, date)
      FROM public.fx_rates WHERE currency = ANY (p_currencies) AND date >= p_since
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.market_data(text[], text[], date) TO authenticated, service_role;
