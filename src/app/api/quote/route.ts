import { NextResponse } from 'next/server';
import { fetchYahooPrice } from '@/lib/services/prices/yahoo';

// Latest quote for one symbol. The trade form uses it to fill in the real trading currency.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol')?.trim();
  const type = searchParams.get('type')?.trim() || undefined;

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  try {
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
