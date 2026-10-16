import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { latestFoBhavcopy } from '@/lib/services/prices/nse';
import { isoDate } from '@/lib/services/market/store';

export type ContractSuggestion = {
  symbol: string;
  underlying: string;
  kind: 'future' | 'option';
  expiry: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  lotSize?: number;
  price: number;
  date: string;
};

// NSE futures and options matching every word typed ("nifty 24500 ce"), from the latest bhavcopy.
export async function GET(req: Request) {
  if (!(await getUser())) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const q = new URL(req.url).searchParams.get('q')?.trim().toUpperCase() ?? '';
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return NextResponse.json([]);

  const b = await latestFoBhavcopy(isoDate()).catch(() => null);
  if (!b) return NextResponse.json({ error: 'NSE prices unavailable' }, { status: 503 });

  const out: ContractSuggestion[] = [];
  for (const r of b.rows.values()) {
    if (!r.symbol.startsWith(words[0]) || !words.every((w) => r.symbol.includes(w))) continue;
    out.push({ symbol: r.symbol, underlying: r.underlying, kind: r.kind, expiry: r.expiry, strike: r.strike, optionType: r.optionType, lotSize: r.lotSize, price: r.settle, date: b.date });
  }
  out.sort((a, b) => a.expiry.localeCompare(b.expiry) || (a.kind === b.kind ? 0 : a.kind === 'future' ? -1 : 1) || (a.strike ?? 0) - (b.strike ?? 0));
  return NextResponse.json(out.slice(0, 25));
}
