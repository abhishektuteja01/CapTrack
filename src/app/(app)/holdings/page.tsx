import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { getPortfolio } from '@/lib/portfolio';
import { HoldingsView } from '@/components/portfolio/holdings-view';
import { EntrySheets } from '@/components/entries/entry-sheets';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Holdings' };

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function HoldingsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = searchParams ? await searchParams : {};
  const platform = first(sp.platform);
  const groupRaw = first(sp.group);
  const group = groupRaw === 'platform' || groupRaw === 'currency' ? groupRaw : undefined;

  const supabase = await supabaseServer();
  const snapshot = await getPortfolio(supabase, { platform, withHistory: false });

  return (
    <>
      <HoldingsView snapshot={snapshot} platform={platform} group={group} />
      <EntrySheets basePath="/holdings" searchParams={sp} />
    </>
  );
}
