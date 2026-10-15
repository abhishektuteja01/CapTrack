import type { Metadata } from 'next';
import { safeNext } from '@/lib/auth-messages';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Reset password' };

// Server-rendered so the form shows before JavaScript loads.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return <ForgotPasswordForm next={safeNext(next)} />;
}
