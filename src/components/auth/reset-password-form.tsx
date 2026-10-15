'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { AuthField, AuthMessage, AuthPanel, TextLink } from '@/components/auth/auth-ui';
import { authErrorMessage } from '@/lib/auth-messages';

export function ResetPasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const [session, setSession] = useState<'checking' | 'ok' | 'missing'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The recovery link signs the user in through /auth/callback before landing here.
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => !cancelled && setSession(data.user ? 'ok' : 'missing'));
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setLoading(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(authErrorMessage(error.message));
    router.replace(next);
    router.refresh();
  }

  if (session === 'missing') {
    return (
      <AuthPanel title="This link has expired" subtitle="Reset links work once and expire after an hour.">
        <TextLink href="/forgot-password" className="text-[13px]">
          Send a new link
        </TextLink>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel title="Set a new password">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <AuthField
          label="New password"
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aside={<span className="text-2xs text-ink-3">8+ characters</span>}
        />
        <AuthField
          label="Repeat it"
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <Button type="submit" variant="primary" disabled={loading || session === 'checking'} className="h-9">
          {loading ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </AuthPanel>
  );
}
