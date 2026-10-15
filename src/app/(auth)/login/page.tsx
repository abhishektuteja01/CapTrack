import type { Metadata } from 'next';
import { safeNext } from '@/lib/auth-messages';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

// Server-rendered so the form shows before JavaScript loads.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return <LoginForm next={safeNext(next)} />;
}
