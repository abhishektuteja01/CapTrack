import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { loadTrade } from '@/lib/trades';
import { getSettings } from '@/lib/user-settings';
import { Panel, PanelHeader } from '@/components/ui/panel';
import TradeForm from '@/components/trades/trade-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit trade' };

/** Full-page edit for direct links. The trades list opens the same form in a side panel. */
export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const [trade, settings] = await Promise.all([loadTrade(supabase, id), getSettings(supabase)]);
  if (!trade) notFound();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <h1 className="text-base font-semibold">Edit {trade.symbol} trade</h1>
      <Panel>
        <PanelHeader title="Trade" />
        <div className="p-4">
          <TradeForm trade={trade} platforms={settings.platforms} baseCurrency={settings.baseCurrency} returnTo="/trades" />
        </div>
      </Panel>
    </div>
  );
}
