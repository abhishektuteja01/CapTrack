import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    supabaseUrl,
    supabasePublishableKey
  );

  const { error } = await supabase.from('trades').select('id').limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
