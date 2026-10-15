import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { getSettings } from '@/lib/user-settings';
import { Panel, PanelHeader } from '@/components/ui/panel';
import TradeForm from '@/components/trades/trade-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Add trade' };

type SearchParams = Record<string, string | string[] | undefined>;

/** Full-page form, used from the Overview and Holdings pages. Returns to `from` after saving. */
export default async function NewTradePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = searchParams ? await searchParams : {};
  const fromRaw = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  const returnTo = fromRaw && fromRaw.startsWith('/') && !fromRaw.startsWith('//') ? fromRaw : '/trades';
  const supabase = await supabaseServer();
  const settings = await getSettings(supabase);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <h1 className="text-base font-semibold">Add trade</h1>
      <Panel>
        <PanelHeader title="Trade" meta={`Totals convert to ${settings.baseCurrency}`} />
        <div className="p-4">
          <TradeForm platforms={settings.platforms} baseCurrency={settings.baseCurrency} returnTo={returnTo} />
        </div>
      </Panel>
    </div>
  );
}
