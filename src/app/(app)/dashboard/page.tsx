import type { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getUser } from '@/lib/supabase/auth';
import { ensureUserBootstrap } from '@/lib/bootstrap';
import { getPortfolio } from '@/lib/portfolio';
import { Button } from '@/components/ui/button';
import { OverviewView } from '@/components/portfolio/overview-view';

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
  const user = await getUser();
  if (!user) redirect('/login');
  // First authenticated landing page: ensure settings exist.
  await ensureUserBootstrap(user.id);

  const sp = searchParams ? await searchParams : undefined;
  const platform = pickFirst(sp?.platform);

  const supabase = await supabaseServer();
  const snapshot = await getPortfolio(supabase, { platform });

  return (
    <OverviewView
      snapshot={snapshot}
      platform={platform}
      refresh={
        <form action={refreshPrices}>
          <Button type="submit" size="sm" variant="ghost">
            Refresh
          </Button>
        </form>
      }
    />
  );
}
