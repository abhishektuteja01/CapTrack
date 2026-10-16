import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getUser } from '@/lib/supabase/auth';
import { readSettings } from '@/lib/portfolio';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import {
  BaseCurrencyForm,
  DeleteAllForm,
  NameForm,
  PlatformsEditor,
  ReturnsForm,
} from '@/components/settings/settings-forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  const supabase = await supabaseServer();
  const settings = await readSettings(supabase);
  const meta = user.user_metadata;
  const name =
    (typeof meta.display_name === 'string' && meta.display_name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    '';

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h1 className="text-base font-semibold">Settings</h1>

      <Panel>
        <PanelHeader title="Base currency" />
        <BaseCurrencyForm current={settings.baseCurrency} />
      </Panel>

      <Panel>
        <PanelHeader title="Returns and tax" />
        <ReturnsForm current={settings.settings} />
      </Panel>

      <Panel>
        <PanelHeader title="Platforms" meta={`${settings.platforms.length}`} />
        <PlatformsEditor current={settings.platforms} />
      </Panel>

      <Panel>
        <PanelHeader title="Data" />
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <ButtonLink href="/api/export" size="sm" prefetch={false}>
            Export everything (CSV)
          </ButtonLink>
          <ButtonLink href="/trades/import" size="sm" variant="ghost">
            Import a CSV
          </ButtonLink>
        </div>
        <DeleteAllForm />
      </Panel>

      <Panel>
        <PanelHeader title="Account" />
        <dl className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 text-[13px]">
          <dt className="text-ink-3">
            <label htmlFor="display-name">Name</label>
          </dt>
          <dd>
            <NameForm current={name} />
          </dd>
          <dt className="text-ink-3">Email</dt>
          <dd className="truncate">{user.email}</dd>
          <dt className="text-ink-3">Session</dt>
          <dd>
            <a href="/auth/logout" className="text-accent hover:underline">
              Sign out
            </a>
          </dd>
        </dl>
      </Panel>

      <p className="px-0.5 text-2xs text-ink-3">
        Prices: Yahoo Finance (stocks, ETFs, crypto, indices), AMFI via mfapi.in (Indian mutual funds) and NSE bhavcopy (futures and
        options, end of day). Exchange rates: European Central Bank, with Yahoo as a fallback.{' '}
        <Link href="https://github.com/abhishektuteja01/CapTrack/blob/main/METHODOLOGY.md" className="text-accent hover:underline">
          How numbers are calculated
        </Link>
      </p>
    </div>
  );
}
