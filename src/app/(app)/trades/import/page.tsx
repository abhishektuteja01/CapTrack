import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { readSettings } from '@/lib/portfolio';
import { ImportView } from '@/components/trades/import-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Import' };

export default async function ImportPage() {
  const supabase = await supabaseServer();
  const settings = await readSettings(supabase);
  return <ImportView platforms={settings.platforms} baseCurrency={settings.baseCurrency} />;
}
