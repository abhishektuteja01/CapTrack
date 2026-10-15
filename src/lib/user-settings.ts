// src/lib/user-settings.ts
// Read the signed-in user's settings. Server only.

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlatforms } from '@/lib/settings';

export async function getSettings(supabase: SupabaseClient) {
  const { data } = await supabase.from('user_settings').select('base_currency, platforms').maybeSingle();
  return {
    baseCurrency: String(data?.base_currency ?? 'USD').toUpperCase(),
    platforms: normalizePlatforms(data?.platforms as string[] | null | undefined),
  };
}
