import { createBrowserClient } from '@supabase/ssr';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/env';

export function supabaseBrowser() {
  return createBrowserClient(
    supabaseUrl,
    supabasePublishableKey,
  );
}