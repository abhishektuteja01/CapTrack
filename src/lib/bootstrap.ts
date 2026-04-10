import { supabaseServer } from '@/lib/supabase/server';

export async function ensureUserBootstrap(userId: string) {
  const supabase = await supabaseServer();

  // Ensure user_settings row exists
  const { data: settings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('user_id')
    .maybeSingle();

  // If a row exists, we're done. If none exists, seed defaults.
  if (settingsErr) {
    throw settingsErr;
  }

  if (!settings) {
    const { error: createSettingsErr } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          base_currency: 'USD',
          platforms: ['Manual'],
        },
        { onConflict: 'user_id' }
      );

    if (createSettingsErr) {
      throw createSettingsErr;
    }
  }
}
