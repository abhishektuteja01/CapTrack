import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { loadFx } from '@/lib/services/market/store';
import { makeFxLookup } from '@/lib/domain/fx/rates';

// Rate for 1 unit of `from` in `to` on `date` (YYYY-MM-DD). Used by the trade form to show the conversion.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from')?.toUpperCase();
  const to = searchParams.get('to')?.toUpperCase();
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  if (!from || !to || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'from, to and date are required' }, { status: 400 });
  }
  if (from === to) return NextResponse.json({ rate: 1, date });

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const rows = await loadFx(supabase, [from, to], date);
  const rate = makeFxLookup(rows)(from, to, date);
  if (rate === undefined) return NextResponse.json({ error: 'Rate unavailable' }, { status: 404 });
  const rateDate = rows
    .filter((r) => r.currency === (from === 'USD' ? to : from) && r.date <= date)
    .reduce((m, r) => (r.date > m ? r.date : m), '');
  return NextResponse.json({ rate, date: rateDate || date });
}
