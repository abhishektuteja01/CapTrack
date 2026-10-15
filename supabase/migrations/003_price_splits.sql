-- 003: stock splits reported by Yahoo, shared by all users. Safe to run more than once.
-- ratio = new units per old unit (10 for a 10:1 split, 0.1 for a 1:10 reverse split).

CREATE TABLE IF NOT EXISTS public.price_splits (
  symbol text NOT NULL,
  date date NOT NULL,
  ratio numeric NOT NULL CHECK (ratio > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, date)
);

ALTER TABLE public.price_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_splits readable" ON public.price_splits;
CREATE POLICY "price_splits readable" ON public.price_splits FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.price_splits TO authenticated;
