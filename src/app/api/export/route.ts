import { getUser } from '@/lib/supabase/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { loadLedger, loadPortfolio } from '@/lib/portfolio';
import { exportCsv, type Draft } from '@/lib/domain/import/formats';
import { toCsv } from '@/lib/domain/import/csv';
import { taxYearOf, taxYearRange } from '@/lib/domain/portfolio/tax';
import { isoDate } from '@/lib/services/market/store';

export const dynamic = 'force-dynamic';

function csvResponse(body: string, name: string) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * GET /api/export — every trade and cash entry in CapTrack's CSV (re-importable).
 * GET /api/export?what=sales&year=2025 — realized sales for one tax year, for your tax return.
 */
export async function GET(req: Request) {
  if (!(await getUser())) return new Response('Sign in first', { status: 401 });
  const supabase = await supabaseServer();
  const sp = new URL(req.url).searchParams;

  if (sp.get('what') === 'sales') {
    const m = await loadPortfolio(supabase, undefined, false);
    const { fyStartMonth } = m.snapshot.settings;
    const year = Number(sp.get('year')) || taxYearOf(isoDate(), fyStartMonth);
    const { from, to } = taxYearRange(year, fyStartMonth);
    const rows = m.sales
      .filter((r) => {
        const d = new Date(r.closedAt).toISOString().slice(0, 10);
        return d >= from && d <= to;
      })
      .map((r) => [
        new Date(r.closedAt).toISOString().slice(0, 10),
        r.symbol,
        r.type,
        r.platform,
        r.direction,
        r.term,
        r.firstOpenedAt.slice(0, 10),
        r.lastOpenedAt.slice(0, 10),
        r.quantity,
        r.currency,
        r.cost.toFixed(2),
        r.proceeds.toFixed(2),
        r.pnl.toFixed(2),
        r.costBase?.toFixed(2),
        r.proceedsBase?.toFixed(2),
        r.pnlBase?.toFixed(2),
        r.settled ? 'expiry' : '',
      ]);
    const base = m.snapshot.baseCurrency;
    const header = ['sold', 'symbol', 'type', 'platform', 'direction', 'term', 'first_bought', 'last_bought', 'quantity', 'currency', 'cost', 'proceeds', 'pnl', `cost_${base}`, `proceeds_${base}`, `pnl_${base}`, 'note'];
    return csvResponse(toCsv(header, rows), `captrack-sales-${year}.csv`);
  }

  const ledger = await loadLedger(supabase);
  const drafts: Draft[] = [
    ...ledger.trades.map((t): Draft => ({
      kind: 'trade',
      occurredAt: t.occurredAt,
      symbol: t.asset.symbol,
      assetType: String(t.asset.type),
      assetName: t.name,
      side: t.side,
      quantity: t.quantity,
      price: t.price,
      fees: t.fees ?? 0,
      currency: t.currency ?? '',
      platform: t.platform,
      notes: t.notes ?? undefined,
      fxRate: t.fxRate ?? undefined,
      fxQuote: t.fxQuote ?? undefined,
      externalId: t.externalId ?? t.id,
      underlying: t.contract?.underlying,
      expiry: t.contract?.expiry,
      strike: t.contract?.strike,
      optionType: t.contract?.optionType,
      lotSize: t.contract?.lotSize,
    })),
    ...ledger.cash.map((c): Draft => ({
      kind: 'cash',
      occurredAt: c.occurredAt,
      cashKind: c.kind,
      amount: c.amount,
      currency: c.currency,
      platform: c.platform,
      assetSymbol: c.assetSymbol ?? undefined,
      assetType: c.assetType ?? undefined,
      notes: c.notes ?? undefined,
      externalId: c.externalId ?? c.id,
    })),
  ].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
  return csvResponse(exportCsv(drafts), `captrack-${isoDate()}.csv`);
}
