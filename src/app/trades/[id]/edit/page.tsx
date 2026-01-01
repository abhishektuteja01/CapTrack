import Link from 'next/link';
import { cookies } from 'next/headers';

import TradeForm from '../../trade-form';
import { supabaseServer } from '@/lib/db/supabase/server';

function normalizePlatforms(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of lines) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }

  return out.length ? out : ['Manual'];
}

export default async function EditTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: t, error: tradeError } = await supabase
    .from('trades')
    .select(
      'id, portfolio_id, occurred_at, asset_symbol, asset_type, side, quantity, price, fees, currency, platform, notes',
    )
    .eq('id', id)
    .single();

  if (tradeError) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Edit trade</h1>
        <p className="text-sm text-zinc-600">Failed to load trade: {tradeError.message}</p>
        <Link
          href="/trades"
          className="inline-flex h-10 items-center justify-center rounded-md border-2 border-zinc-900 bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Back to trades
        </Link>
      </div>
    );
  }

  const { data: portfolios, error: portfoliosError } = await supabase
    .from('portfolios')
    .select('id, name')
    .eq('id', t.portfolio_id)
    .limit(1);

  if (portfoliosError) {
    throw new Error(portfoliosError.message);
  }

  const portfolio = portfolios?.[0];

  const cookieStore = await cookies();
  const platformsCookie = cookieStore.get('captrack_platforms')?.value;
  const platforms = normalizePlatforms((platformsCookie ?? 'Manual').replaceAll('%0A', '\n'));

  const toDateTimeLocalValue = (value: unknown) => {
    if (!value) return '';

    // Supabase may return ISO string, or a Date-like value.
    const s = typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : String(value);

    // If already in a datetime-local compatible shape, just trim.
    // Accepts: YYYY-MM-DDTHH:mm (optionally with seconds)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
      return s.slice(0, 16);
    }

    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return '';

    // Convert to local time and format as YYYY-MM-DDTHH:mm for <input type="datetime-local">
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  };

  const occurredAtLocalValue = toDateTimeLocalValue(t.occurred_at);

  // Shape expected by TradeForm
  const editTrade = {
    id: String(t.id),
    occurredAtLocal: occurredAtLocalValue,
    symbol: String(t.asset_symbol ?? ''),
    assetType: String(t.asset_type ?? ''),
    side: (t.side as 'BUY' | 'SELL') ?? 'BUY',
    quantity: typeof t.quantity === 'number' ? t.quantity : Number(t.quantity),
    price: typeof t.price === 'number' ? t.price : Number(t.price),
    fees: typeof t.fees === 'number' ? t.fees : Number(t.fees),
    currency: String(t.currency ?? ''),
    platform: t.platform ?? null,
    notes: (t.notes ?? null) as string | null,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit trade</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {portfolio ? (
              <>
                Editing <span className="font-semibold text-zinc-900">{t.asset_symbol}</span> in{' '}
                <span className="font-semibold text-zinc-900">{portfolio.name}</span>
              </>
            ) : (
              <>
                Editing <span className="font-semibold text-zinc-900">{t.asset_symbol}</span>
              </>
            )}
          </p>
        </div>

        <Link
          href="/trades"
          className="inline-flex h-10 items-center justify-center rounded-md border-2 border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:border-0 md:rounded-none md:p-0">
        <div className="mb-3 flex items-center justify-between md:px-0">
          <h2 className="text-sm font-semibold text-zinc-900">Trade details</h2>
          <p className="text-xs text-zinc-500">Saved to Supabase</p>
        </div>
        <TradeForm portfolioId={t.portfolio_id} editTrade={editTrade} platforms={platforms} />
      </section>

      <p className="text-xs text-zinc-500">
        Tip: update Platforms in <Link href="/settings" className="underline">Settings</Link>.
      </p>
    </div>
  );
}