import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { listTrades, loadTrade } from '@/lib/trades';
import { getSettings } from '@/lib/user-settings';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import TradeFilters from '@/components/trades/trade-filters';
import { TradesTable } from '@/components/trades/trades-table';
import { TradeSheet } from '@/components/trades/trade-sheet';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Trades' };

const PAGE_SIZE = 50;

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TradesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = searchParams ? await searchParams : {};
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1);
  const symbol = first(sp.q)?.trim() || undefined;
  const platform = first(sp.platform) || undefined;
  const sideRaw = first(sp.side);
  const side = sideRaw === 'BUY' || sideRaw === 'SELL' ? sideRaw : undefined;
  const editId = first(sp.edit);
  const isNew = sp.new !== undefined;

  // Same filters without the panel params: where the panel returns to.
  const base = new URLSearchParams();
  if (symbol) base.set('q', symbol);
  if (platform) base.set('platform', platform);
  if (side) base.set('side', side);
  const listHref = (p = page) => {
    const q = new URLSearchParams(base);
    if (p > 1) q.set('page', String(p));
    return q.size ? `/trades?${q}` : '/trades';
  };
  const withParam = (k: string, v: string) => {
    const q = new URLSearchParams(base);
    if (page > 1) q.set('page', String(page));
    q.set(k, v);
    return `/trades?${q}`;
  };

  const supabase = await supabaseServer();
  const [{ rows, total }, settings, editTrade] = await Promise.all([
    listTrades(supabase, { page, pageSize: PAGE_SIZE, symbol, platform, side }),
    getSettings(supabase),
    editId ? loadTrade(supabase, editId) : Promise.resolve(null),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) redirect(listHref(pages));
  const filtered = Boolean(symbol || platform || side);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Trades</h1>
        <div className="flex flex-wrap items-center gap-2">
          <TradeFilters platforms={settings.platforms} />
          <ButtonLink href={withParam('new', '1')} scroll={false} size="sm" variant="primary">
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
          <TradesTable rows={rows} editHrefs={Object.fromEntries(rows.map((r) => [r.id, withParam('edit', r.id)]))} />
        ) : filtered ? (
          <EmptyState
            title="No trades match these filters"
            action={
              <ButtonLink href="/trades" size="sm">
                Clear filters
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No trades yet"
            body="Every buy and sell you log here builds your positions, returns and history."
            action={
              <ButtonLink href={withParam('new', '1')} scroll={false} variant="primary">
                Add your first trade
              </ButtonLink>
            }
          />
        )}
      </Panel>

      {isNew || editTrade ? (
        <TradeSheet
          key={editTrade?.id ?? 'new'}
          trade={editTrade ?? undefined}
          platforms={settings.platforms}
          baseCurrency={settings.baseCurrency}
          closeHref={listHref()}
        />
      ) : null}
    </div>
  );
}
