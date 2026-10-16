import { cache } from 'react';
import { supabaseServer } from '@/lib/supabase/server';

export type SessionUser = {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
};

/**
 * The signed-in user from the session's JWT, verified locally against the project's public signing key
 * (no round trip to Supabase Auth). Once per request. `null` when signed out.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const c = data.claims;
  return {
    id: c.sub,
    email: typeof c.email === 'string' ? c.email : undefined,
    user_metadata: (c.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
});

export function displayName(user: Pick<SessionUser, 'email' | 'user_metadata'>) {
  const m = user.user_metadata ?? {};
  if (typeof m.display_name === 'string' && m.display_name.trim()) return m.display_name.trim();
  if (typeof m.full_name === 'string' && m.full_name.trim()) return m.full_name.trim();
  return user.email?.split('@')[0] ?? 'Account';
}
