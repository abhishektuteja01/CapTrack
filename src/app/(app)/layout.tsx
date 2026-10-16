import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { displayName, getUser } from '@/lib/supabase/auth';
import { AppFrame } from '@/components/layout/app-frame';

export const dynamic = 'force-dynamic';

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
