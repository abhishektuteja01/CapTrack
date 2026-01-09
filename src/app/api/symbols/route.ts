import { NextResponse } from 'next/server';

// Normalized symbol suggestion returned to the client
export type SymbolSuggestion = {
  symbol: string; // e.g. AAPL, SPY, BTC-USD, RELIANCE.NS
  name: string; // Apple Inc.
  type: 'stock' | 'etf' | 'crypto' | 'fund' | 'other';
  exchange?: string; // NASDAQ, NSE, etc.
};

function normalizeType(quoteType?: string): SymbolSuggestion['type'] {
  switch (quoteType) {
    case 'EQUITY':
      return 'stock';
    case 'ETF':
      return 'etf';
    case 'CRYPTOCURRENCY':
      return 'crypto';
    case 'MUTUALFUND':
      return 'fund';
    default:
      return 'other';
  }
}

type YahooSearchQuote = {
  symbol?: string;
  shortname?: string;
  quoteType?: string;
  exchange?: string;
};

function isYahooSearchQuote(value: unknown): value is YahooSearchQuote {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.symbol === 'string' && typeof v.shortname === 'string';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 1) {
    return NextResponse.json([]);
  }

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    q
  )}&quotesCount=10&newsCount=0`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'CapTrack/1.0',
        Accept: 'application/json',
      },
      // Cache briefly to stay well within Yahoo limits
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const json = await res.json();

    const rawQuotes: unknown = (json as { quotes?: unknown }).quotes;
    const quotes = Array.isArray(rawQuotes) ? rawQuotes : [];

    const suggestions: SymbolSuggestion[] = quotes
      .filter(isYahooSearchQuote)
      .map((q) => ({
        symbol: q.symbol!,
        name: q.shortname!,
        type: normalizeType(q.quoteType),
        exchange: q.exchange,
      }));

    return NextResponse.json(suggestions);
  } catch {
    // Fail soft — autocomplete should never break the form
    return NextResponse.json([]);
  }
}