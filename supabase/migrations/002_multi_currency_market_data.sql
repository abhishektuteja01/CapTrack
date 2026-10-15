-- 002: any ISO currency, per-trade FX override, shared market data tables.
-- Safe to run more than once. Run in the Supabase SQL editor.

-- 1. Drop any USD/INR-only rule on currency columns, and turn enum columns into text.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid IN ('public.trades'::regclass, 'public.user_settings'::regclass)
      AND pg_get_constraintdef(c.oid) ~* 'currency'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;

  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'trades' AND column_name = 'currency') = 'USER-DEFINED' THEN
    ALTER TABLE public.trades ALTER COLUMN currency TYPE text USING currency::text;
  END IF;

  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'base_currency') = 'USER-DEFINED' THEN
    ALTER TABLE public.user_settings ALTER COLUMN base_currency TYPE text USING base_currency::text;
  END IF;
END $$;

ALTER TABLE public.trades
  ADD CONSTRAINT trades_currency_iso CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_base_currency_iso CHECK (base_currency ~ '^[A-Z]{3}$');

-- 2. Optional broker rate on a trade: 1 unit of `currency` = fx_rate units of fx_quote.
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS fx_rate numeric;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS fx_quote text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trades_fx_override_valid') THEN
    ALTER TABLE public.trades ADD CONSTRAINT trades_fx_override_valid CHECK (
      (fx_rate IS NULL AND fx_quote IS NULL)
      OR (fx_rate > 0 AND fx_quote ~ '^[A-Z]{3}$')
    );
  END IF;
END $$;

-- 3. Daily FX: USD per 1 unit of currency. Shared by all users; written only by the service role.
CREATE TABLE IF NOT EXISTS public.fx_rates (
  date date NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  usd_per_unit numeric NOT NULL CHECK (usd_per_unit > 0),
  source text NOT NULL DEFAULT 'auto',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, currency)
);
CREATE INDEX IF NOT EXISTS fx_rates_currency_date ON public.fx_rates (currency, date);

-- 4. Daily closes per Yahoo symbol, in the major currency unit (pence already converted to pounds).
CREATE TABLE IF NOT EXISTS public.price_history (
  symbol text NOT NULL,
  date date NOT NULL,
  close numeric NOT NULL CHECK (close >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, date)
);

-- 5. Signed-in users can read market data; nobody but the service role can write it.
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fx_rates readable" ON public.fx_rates;
CREATE POLICY "fx_rates readable" ON public.fx_rates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "price_history readable" ON public.price_history;
CREATE POLICY "price_history readable" ON public.price_history FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.fx_rates, public.price_history TO authenticated;
