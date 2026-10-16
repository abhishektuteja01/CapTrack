import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { getPortfolio } from '@/lib/portfolio';
import { Button } from '@/components/ui/button';
import { OverviewView } from '@/components/portfolio/overview-view';
import { SetupForm } from '@/components/settings/settings-forms';
import { EntrySheets } from '@/components/entries/entry-sheets';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Overview' };

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

async function refreshPrices() {
  'use server';
  revalidatePath('/dashboard');
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = searchParams ? await searchParams : {};
  const platform = pickFirst(sp.platform);

  const supabase = await supabaseServer();
  const snapshot = await getPortfolio(supabase, { platform });

  return (
    <>
      <OverviewView
        snapshot={snapshot}
        platform={platform}
        setup={<SetupForm baseCurrency={snapshot.baseCurrency} platforms={snapshot.platforms} />}
        refresh={
          <form action={refreshPrices}>
            <Button type="submit" size="sm" variant="ghost">
              Refresh
            </Button>
          </form>
        }
      />
      <EntrySheets basePath="/dashboard" searchParams={sp} />
    </>
  );
}
