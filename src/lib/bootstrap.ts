import { supabaseServer } from '@/lib/supabase/server';

export async function ensureUserBootstrap(userId: string) {
  const supabase = await supabaseServer();

  // 1. Ensure default portfolio exists
  const { data: portfolios, error: portfoliosErr } = await supabase
    .from('portfolios')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1);

  if (portfoliosErr) {
    throw portfoliosErr;
  }

  if (!portfolios || portfolios.length === 0) {
    const { data: created, error: createPortfolioErr } = await supabase
      .from('portfolios')
      .insert({
        user_id: userId,
        name: 'Main',
      })
      .select('id')
      .single();

    if (createPortfolioErr) {
      throw createPortfolioErr;
    }

    // As a safety net, if insert didn't return an id, re-check.
    if (!created?.id) {
      const retry = await supabase
        .from('portfolios')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1);
      if (retry.error) throw retry.error;
    }
  }

  // 2. Ensure user_settings row exists
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
