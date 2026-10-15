// src/lib/supabase/env.ts
// Supabase keys. Prefers the new publishable/secret keys and falls back to the legacy anon/service_role names.
// NEXT_PUBLIC_ vars are referenced literally so Next can inline them into browser bundles.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
