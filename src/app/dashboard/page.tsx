import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/db/supabase/server';
import { derivePositions } from '@/lib/domain/portfolio/positions';
import { fetchYahooPrices, getUsdInrRateCached, toYahooSymbol } from '@/lib/services/prices/yahoo';
import { cookies } from 'next/headers';

type SearchParams = Record<string, string | string[] | undefined>;

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

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  async function refreshDashboard() {
    'use server';
    revalidatePath('/dashboard');
  }

  const sp = searchParams ? await searchParams : undefined;
  const platformFilterRaw = pickFirst(sp?.platform);
  const platformFilter = platformFilterRaw ? String(platformFilterRaw) : undefined;

  const cookieStore = await cookies();
  const baseFromCookie = (cookieStore.get('captrack_base_ccy')?.value ?? 'USD').toUpperCase();
  const BASE_CCY: 'USD' | 'INR' = baseFromCookie === 'INR' ? 'INR' : 'USD';

  const platformsCookie = cookieStore.get('captrack_platforms')?.value;
  const platforms = normalizePlatforms((platformsCookie ?? 'Manual').replaceAll('%0A', '\n'));

  const supabase = await supabaseServer();

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1);

  const portfolio = portfolios?.[0];

  if (!portfolio) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">No portfolio found.</p>
      </div>
    );
  }

  const { data: trades } = await supabase
    .from('trades')
    .select(
      'occurred_at, asset_symbol, asset_type, side, quantity, price, fees, currency, platform'
    )
    .eq('portfolio_id', portfolio.id);

  const filteredTrades = (trades ?? []).filter((t) => {
    if (!platformFilter) return true;
    return String((t as any).platform ?? 'Manual') === platformFilter;
  });

  const positions = derivePositions(
    filteredTrades.map((t) => ({
      occurredAt: t.occurred_at,
      asset: { symbol: t.asset_symbol, type: t.asset_type },
      side: t.side,
      quantity: Number(t.quantity),
      price: Number(t.price),
      fees: Number(t.fees),
      currency: t.currency,
    }))
  );

  const fmtMoney = (n: number, ccy?: string) => {
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    const formatted = abs >= 1
      ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return ccy ? `${formatted} ${ccy}` : formatted;
  };

  const fmtQty = (n: number) => {
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const pnlClass = (n?: number) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return 'text-zinc-900';
    if (n > 0) return 'text-emerald-600';
    if (n < 0) return 'text-rose-600';
    return 'text-zinc-900';
  };

  const pnlBgClass = (n?: number) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return 'bg-zinc-100 text-zinc-700';
    if (n > 0) return 'bg-emerald-50 text-emerald-700';
    if (n < 0) return 'bg-rose-50 text-rose-700';
    return 'bg-zinc-100 text-zinc-700';
  };

  const currenciesFromTrades = new Set(
    filteredTrades.map((t) => String(t.currency ?? '').toUpperCase()).filter(Boolean)
  );

  const needsUsdInrFx =
    (currenciesFromTrades.has('INR') && BASE_CCY === 'USD') ||
    (currenciesFromTrades.has('USD') && BASE_CCY === 'INR');

  const quoteInputs = positions.map((p) => ({
    symbol: p.asset.symbol,
    assetType: String(p.asset.type),
  }));

  // No longer add USDINR=X here; use FX cache helper later.

  const quotes = await fetchYahooPrices(quoteInputs);

  const quoteByYahooSymbol = new Map(
    quotes.map((q) => [q.symbol.toUpperCase(), q])
  );

  const fxUsdInr = needsUsdInrFx ? await getUsdInrRateCached() : undefined;

  const fxFactorToBase = (ccy?: string) => {
    const cur = (ccy ?? '').toUpperCase();
    if (!cur || cur === BASE_CCY) return 1;

    // v1: only USD/INR conversion
    if (BASE_CCY === 'USD' && cur === 'INR') {
      return typeof fxUsdInr === 'number' && fxUsdInr > 0 ? 1 / fxUsdInr : undefined;
    }
    if (BASE_CCY === 'INR' && cur === 'USD') {
      return typeof fxUsdInr === 'number' && fxUsdInr > 0 ? fxUsdInr : undefined;
    }

    return undefined;
  };

  const enriched = positions.map((p) => {
    const yahooSymbol = toYahooSymbol(
      p.asset.symbol,
      String(p.asset.type)
    ).toUpperCase();
    const q = quoteByYahooSymbol.get(yahooSymbol);

    const price = q?.price;
    const ccy = q?.currency ?? p.currency;
    const displayName = q?.name;

    const marketValue = typeof price === 'number' ? p.quantity * price : undefined;
    const unrealized =
      typeof marketValue === 'number' ? marketValue - p.costBasis : undefined;
    const unrealizedPct =
      typeof unrealized === 'number' && p.costBasis !== 0
        ? unrealized / p.costBasis
        : undefined;

    const factor = fxFactorToBase(ccy);
    const costBasisBase = typeof factor === 'number' ? p.costBasis * factor : undefined;
    const marketValueBase = typeof factor === 'number' && typeof marketValue === 'number' ? marketValue * factor : undefined;
    const unrealizedBase = typeof factor === 'number' && typeof unrealized === 'number' ? unrealized * factor : undefined;

    return {
      ...p,
      yahooSymbol,
      displayName,
      livePrice: price,
      liveCurrency: ccy,
      marketValue,
      unrealized,
      unrealizedPct,
      costBasisBase,
      marketValueBase,
      unrealizedBase,
      quoteTimestamp: q?.timestamp,
    };
  });

  const totals = enriched.reduce(
    (acc, p) => {
      if (typeof p.marketValue === 'number') acc.marketValue += p.marketValue;
      acc.costBasis += p.costBasis;
      if (typeof p.unrealized === 'number') acc.unrealized += p.unrealized;
      return acc;
    },
    { marketValue: 0, costBasis: 0, unrealized: 0 }
  );

  const totalsBase = enriched.reduce(
    (acc, p) => {
      if (typeof p.marketValueBase === 'number') acc.marketValue += p.marketValueBase;
      if (typeof p.costBasisBase === 'number') acc.costBasis += p.costBasisBase;
      if (typeof p.unrealizedBase === 'number') acc.unrealized += p.unrealizedBase;
      return acc;
    },
    { marketValue: 0, costBasis: 0, unrealized: 0 }
  );

  const currencySet = new Set(
    enriched
      .map((p) => (p.liveCurrency ?? p.currency ?? '').toUpperCase())
      .filter(Boolean)
  );
  const hasMixedCurrencies = currencySet.size > 1;

  const fxReady = !hasMixedCurrencies || typeof fxUsdInr === 'number' && fxUsdInr > 0;

  const totalsPct = totalsBase.costBasis !== 0 ? totalsBase.unrealized / totalsBase.costBasis : 0;

  const primaryCurrency = BASE_CCY;

  return (
    <div className="space-y-4">
      <section className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-xs text-zinc-500">
            {portfolio.name} • {enriched.length} assets
          </p>
        </div>

        <form action={refreshDashboard}>
          <button
            type="submit"
            aria-label="Refresh prices"
            title="Refresh prices"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm text-zinc-900 hover:bg-zinc-100"
          >
            ⟳
          </button>
        </form>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link
          href="/dashboard"
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            !platformFilter
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          All
        </Link>
        {platforms.map((p) => (
          <Link
            key={p}
            href={`/dashboard?platform=${encodeURIComponent(p)}`}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              platformFilter === p
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {p}
          </Link>
        ))}
      </section>

      {hasMixedCurrencies ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-700">
          Totals are converted to <span className="font-semibold">{BASE_CCY}</span>
          {typeof fxUsdInr === 'number' && fxUsdInr > 0 ? (
            <> using <span className="font-mono">USDINR=X</span> @ {fxUsdInr.toFixed(4)}.</>
          ) : (
            <>. FX rate unavailable — totals may be incomplete.</>
          )}
        </div>
      ) : null}

      {/* Summary block */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-zinc-500">Invested</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
              {fxReady ? fmtMoney(totalsBase.costBasis) : '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Current</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
              {fxReady ? fmtMoney(totalsBase.marketValue) : '—'}
            </div>
          </div>
        </div>

        <div className="my-4 h-px w-full bg-zinc-200" />

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-zinc-500">P&amp;L</div>
          <div className="flex items-center gap-2">
            <div className={`text-xl font-semibold tabular-nums ${pnlClass(fxReady ? totalsBase.unrealized : undefined)}`}>
              {fxReady && totalsBase.unrealized >= 0 ? '+' : ''}
              {fxReady ? fmtMoney(totalsBase.unrealized, primaryCurrency) : '—'}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${pnlBgClass(fxReady ? totalsBase.unrealized : undefined)}`}>
              {fxReady ? `${(totalsPct * 100).toFixed(2)}%` : '—'}
            </span>
          </div>
        </div>
      </section>

      {/* Positions list */}
      <section className="rounded-2xl border border-zinc-200 bg-white">
        {enriched.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600">No positions yet. Add trades to get started.</div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {enriched.map((p) => {
              const ltpPct = typeof p.avgCost === 'number' && p.avgCost !== 0 && typeof p.livePrice === 'number'
                ? (p.livePrice - p.avgCost) / p.avgCost
                : undefined;

              return (
                <li key={`${p.asset.type}:${p.asset.symbol}`} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side */}
                    <div className="min-w-0">
                      <div className="text-xs">
                        <span className="font-medium text-zinc-700">Qty</span>{' '}
                        <span className="text-zinc-500">{fmtQty(p.quantity)}</span>
                        {' • '}
                        <span className="font-medium text-zinc-700">Avg</span>{' '}
                        <span className="text-zinc-500">{fmtMoney(p.avgCost, p.liveCurrency ?? p.currency)}</span>
                      </div>
                      <div className="mt-1 truncate text-lg font-bold tracking-tight text-zinc-900">
                        {p.asset.symbol}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Invested {fmtMoney(p.costBasis, p.liveCurrency ?? p.currency)}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="shrink-0 text-right">
                      <div className={`text-xs font-semibold tabular-nums ${pnlClass(p.unrealized)}`}>
                        {typeof p.unrealizedPct === 'number' ? `${(p.unrealizedPct * 100).toFixed(2)}%` : '—'}
                      </div>
                      <div className={`mt-1 text-lg font-bold tabular-nums ${pnlClass(p.unrealized)}`}>
                        {typeof p.unrealized === 'number' ? (
                          <>
                            {p.unrealized >= 0 ? '+' : ''}
                            {fmtMoney(p.unrealized, p.liveCurrency ?? p.currency)}
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 tabular-nums">
                        LTP{' '}
                        {typeof p.livePrice === 'number'
                          ? fmtMoney(p.livePrice, p.liveCurrency ?? p.currency)
                          : '—'}
                        {typeof ltpPct === 'number' ? (
                          <span>
                            {' '}
                            ({(ltpPct * 100).toFixed(2)}%)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
