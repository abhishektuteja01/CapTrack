import Link from 'next/link';

import TradeForm from '@/components/trades/trade-form';
import { FadeIn } from '@/components/ui/fade-in';
import { supabaseServer } from '@/lib/supabase/server';

function normalizePlatforms(raw: string[] | null | undefined): string[] {
  const items = (raw ?? []).map((s) => String(s).trim()).filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of items) {
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

  const { data: userSettings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('platforms')
    .single();

  if (settingsErr) {
    console.warn('Failed to load user settings:', settingsErr.message);
  }

  const platforms = normalizePlatforms(userSettings?.platforms as string[] | null | undefined);

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
    <div className="max-w-2xl mx-auto space-y-6">
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Edit Trade</h1>
            <p className="text-sm text-zinc-600">
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
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </FadeIn>

      <FadeIn delay={0.1} className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Trade Details</h2>
          <p className="text-[10px] uppercase tracking-wider font-medium text-zinc-400">Secure Edit</p>
        </div>
        <TradeForm portfolioId={t.portfolio_id} editTrade={editTrade} platforms={platforms} />
      </FadeIn>

      <FadeIn delay={0.2} className="text-center">
        <p className="text-xs text-zinc-400">
          Tip: update Platforms in <Link href="/settings" className="underline hover:text-zinc-900">Settings</Link>.
        </p>
      </FadeIn>
    </div>
  );
}