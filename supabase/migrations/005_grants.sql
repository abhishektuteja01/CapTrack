-- 005: explicit table privileges. Newer Supabase projects no longer grant read/write on new tables to the
-- API roles by default, so every role gets exactly what the app uses. Safe to run more than once.
-- RLS still decides which rows: users see only their own; only the service role writes market data.

-- Signed-in users: their own trades, cash and settings; read-only market data.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades, public.cash_entries, public.user_settings TO authenticated;
GRANT SELECT ON public.activity, public.fx_rates, public.price_history, public.price_splits, public.price_dividends TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_data(text[], text[], date) TO authenticated;

-- Service role (server-side secret key): writes shared market data; the nightly job reads every user's
-- symbols and currencies.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_rates, public.price_history, public.price_splits, public.price_dividends TO service_role;
GRANT SELECT ON public.trades, public.cash_entries, public.user_settings, public.activity TO service_role;
GRANT EXECUTE ON FUNCTION public.market_data(text[], text[], date) TO service_role;

-- Signed-out visitors get nothing.
REVOKE ALL ON public.trades, public.cash_entries, public.user_settings, public.activity,
  public.fx_rates, public.price_history, public.price_splits, public.price_dividends FROM anon;
REVOKE EXECUTE ON FUNCTION public.market_data(text[], text[], date) FROM anon, public;
