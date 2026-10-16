import { NextResponse } from 'next/server';
import { fetchYahooPrice } from '@/lib/services/prices/yahoo';
import { fetchMfLatest, isSchemeCode } from '@/lib/services/prices/mfapi';

// Latest quote for one symbol. The trade form uses it to fill in the name, currency and last price.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol')?.trim();
  const type = searchParams.get('type')?.trim() || undefined;

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  try {
    if (type === 'mutual_fund' && isSchemeCode(symbol)) {
      const f = await fetchMfLatest(symbol);
      return NextResponse.json({ symbol, name: f.name, price: f.nav, currency: 'INR', exchange: 'AMFI', timestamp: Date.parse(f.date) });
    }
    const q = await fetchYahooPrice(symbol, type);
    return NextResponse.json({
      symbol: q.symbol,
      name: q.name,
      price: q.price,
      currency: q.currency,
      exchange: q.exchange,
      timestamp: q.timestamp,
    });
  } catch {
    // Fail soft: the form falls back to manual currency entry
    return NextResponse.json({ error: 'Quote unavailable' }, { status: 404 });
  }
}
