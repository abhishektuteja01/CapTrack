import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// Daily Vercel cron: one tiny query so a free Supabase project isn't paused for inactivity.
export async function GET() {
  const supabase = supabaseService();
  if (!supabase) return NextResponse.json({ ok: false, error: 'SUPABASE_SECRET_KEY is not set' }, { status: 500 });

  const { error } = await supabase.from('fx_rates').select('date').limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
