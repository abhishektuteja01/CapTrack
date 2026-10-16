import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { listActivity } from '@/lib/trades';
import { readSettings } from '@/lib/portfolio';
import { sheetHref } from '@/lib/sheet-links';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import TradeFilters from '@/components/trades/trade-filters';
import { ActivityTable } from '@/components/trades/trades-table';
import { EntrySheets } from '@/components/entries/entry-sheets';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Activity' };

const PAGE_SIZE = 50;
const KINDS = ['BUY', 'SELL', 'deposit', 'withdrawal', 'dividend', 'interest', 'fee'];

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ActivityPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = searchParams ? await searchParams : {};
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1);
  const symbol = first(sp.q)?.trim() || undefined;
  const platform = first(sp.platform) || undefined;
  const kindRaw = first(sp.kind) ?? first(sp.side);
  const kind = kindRaw && KINDS.includes(kindRaw) ? kindRaw : undefined;

  // Filters without the panel or page params.
  const base = new URLSearchParams();
  if (symbol) base.set('q', symbol);
  if (platform) base.set('platform', platform);
  if (kind) base.set('kind', kind);
  const listHref = (p = page) => {
    const q = new URLSearchParams(base);
    if (p > 1) q.set('page', String(p));
    return q.size ? `/trades?${q}` : '/trades';
  };
  const here = new URLSearchParams(base);
  if (page > 1) here.set('page', String(page));

  const supabase = await supabaseServer();
  const [{ rows, total }, settings] = await Promise.all([
    listActivity(supabase, { page, pageSize: PAGE_SIZE, symbol, platform, kind }),
    readSettings(supabase),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(listHref(pages));
  const filtered = Boolean(symbol || platform || kind);
  const editHrefs = Object.fromEntries(
    rows.map((r) => [`${r.entry}:${r.id}`, sheetHref('/trades', here, r.entry === 'trade' ? { trade: r.id } : { cash: r.id })])
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Activity</h1>
        <div className="flex flex-wrap items-center gap-2">
          <TradeFilters platforms={settings.platforms} />
          <ButtonLink href="/trades/import" size="sm" variant="ghost">
            Import
          </ButtonLink>
          <ButtonLink href="/api/export" size="sm" variant="ghost" prefetch={false}>
            Export
          </ButtonLink>
          <ButtonLink href={sheetHref('/trades', here, { cash: 'new' })} scroll={false} size="sm">
            Add cash
          </ButtonLink>
          <ButtonLink href={sheetHref('/trades', here, { trade: 'new' })} scroll={false} size="sm" variant="primary">
            Add trade
          </ButtonLink>
        </div>
      </div>

      <Panel>
        <PanelHeader
          title={`Log · ${total}`}
          meta={filtered ? 'filtered' : 'newest first'}
          actions={
            pages > 1 ? (
              <nav aria-label="Pages" className="num flex items-center gap-1 text-2xs text-ink-3">
                {page > 1 ? (
                  <ButtonLink href={listHref(page - 1)} size="sm" variant="ghost">
                    Newer
                  </ButtonLink>
                ) : null}
                <span>
                  {page} / {pages}
                </span>
                {page < pages ? (
                  <ButtonLink href={listHref(page + 1)} size="sm" variant="ghost">
                    Older
                  </ButtonLink>
                ) : null}
              </nav>
            ) : null
          }
        />
        {rows.length ? (
          <ActivityTable rows={rows} editHrefs={editHrefs} />
        ) : filtered ? (
          <EmptyState
            title="Nothing matches these filters"
            action={
              <ButtonLink href="/trades" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No activity yet"
            body="Every buy, sell, deposit and dividend you log here builds your positions, returns and history. Have a broker export? Import it."
            action={
              <span className="flex gap-2">
                <ButtonLink href={sheetHref('/trades', here, { trade: 'new' })} scroll={false} variant="primary">
                  Add your first trade
                </ButtonLink>
                <ButtonLink href="/trades/import">Import a CSV</ButtonLink>
              </span>
            }
          />
        )}
      </Panel>

      <EntrySheets basePath="/trades" searchParams={sp} />
    </div>
  );
}
