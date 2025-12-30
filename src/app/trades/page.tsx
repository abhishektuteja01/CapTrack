// src/app/trades/page.tsx
import { supabaseServer } from '@/lib/db/supabase/server';
import TradeForm from './trade-form';

export default async function TradesPage() {
  const supabase = await supabaseServer();

  // For v1 we just grab the first portfolio.
  // Later: allow selecting portfolios, per-user portfolios, etc.
  const { data: portfolios, error } = await supabase
    .from('portfolios')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Trades</h1>
        <p>Failed to load portfolios: {error.message}</p>
      </div>
    );
  }

  const portfolio = portfolios?.[0];

  if (!portfolio) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Trades</h1>
        <p>No portfolio found. Create a “Main” portfolio row in Supabase first.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Trades</h1>
      <p style={{ marginBottom: 16 }}>Adding trades into: <b>{portfolio.name}</b></p>

      <TradeForm portfolioId={portfolio.id} />
    </div>
  );
}