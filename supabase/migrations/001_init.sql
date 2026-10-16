-- 001: the two tables everything starts from, trades and user_settings, with row-level security.
-- A fresh project runs 001 → 004 in order. Safe to run more than once: on a project that already has
-- these tables (created before migrations were kept here) it changes nothing.

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  base_currency text NOT NULL DEFAULT 'USD',
  platforms text[] NOT NULL DEFAULT ARRAY['Manual'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  asset_symbol text NOT NULL,
  asset_type text NOT NULL,
  asset_name text,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  price numeric NOT NULL CHECK (price >= 0),
  fees numeric NOT NULL DEFAULT 0 CHECK (fees >= 0),
  currency text NOT NULL,
  platform text DEFAULT 'Manual',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'adjustment')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades (user_id);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Policies only when a table has none yet, so existing projects keep their own.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trades') THEN
    CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    CREATE POLICY "Users manage own settings" ON public.user_settings FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades, public.user_settings TO authenticated;
