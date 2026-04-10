-- Migration: Link trades directly to user_id, removing portfolios indirection
-- Run this in the Supabase SQL Editor as a single transaction BEFORE deploying code changes.

BEGIN;

-- 1. Add user_id column (nullable initially for backfill)
ALTER TABLE trades ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- 2. Backfill user_id from the portfolios join
UPDATE trades
SET user_id = p.user_id
FROM portfolios p
WHERE trades.portfolio_id = p.id;

-- 3. Make user_id NOT NULL after backfill
ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;

-- 4. Create index for RLS performance
CREATE INDEX idx_trades_user_id ON trades(user_id);

-- 5. Drop existing RLS policies on trades (actual names from Supabase)
DROP POLICY IF EXISTS "select trades in own portfolios" ON trades;
DROP POLICY IF EXISTS "insert trades into own portfolios" ON trades;
DROP POLICY IF EXISTS "update trades in own portfolios" ON trades;
DROP POLICY IF EXISTS "delete trades in own portfolios" ON trades;

-- 6. Create new RLS policies using user_id directly
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON trades FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Drop the old portfolio_id column and portfolios table
ALTER TABLE trades DROP COLUMN portfolio_id;
DROP TABLE IF EXISTS portfolios;

COMMIT;
