import { supabaseServer } from '@/lib/supabase/server';

export async function getUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error) return null;
  return data.user;
}