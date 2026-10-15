import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { getUser } from '@/lib/supabase/auth';
import { AppFrame } from '@/components/layout/app-frame';

export const dynamic = 'force-dynamic';

function displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const m = user.user_metadata ?? {};
  if (typeof m.display_name === 'string' && m.display_name.trim()) return m.display_name.trim();
  if (typeof m.full_name === 'string' && m.full_name.trim()) return m.full_name.trim();
  return user.email?.split('@')[0] ?? 'Account';
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <AppFrame name={displayName(user)} email={user.email}>
      {children}
    </AppFrame>
  );
}
