import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getSettings } from '@/lib/user-settings';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { BaseCurrencyForm, NameForm, PlatformsEditor } from '@/components/settings/settings-forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const settings = await getSettings(supabase);
  const meta = data.user.user_metadata ?? {};
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
        <PanelHeader title="Platforms" meta={`${settings.platforms.length}`} />
        <PlatformsEditor current={settings.platforms} />
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
          <dd className="truncate">{data.user.email}</dd>
          <dt className="text-ink-3">Session</dt>
          <dd>
            <a href="/auth/logout" className="text-accent hover:underline">
              Sign out
            </a>
          </dd>
        </dl>
      </Panel>

      <p className="px-0.5 text-2xs text-ink-3">
        Prices come from Yahoo Finance and exchange rates from the European Central Bank, with Yahoo as a fallback.
      </p>
    </div>
  );
}
