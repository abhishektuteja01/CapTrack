'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { AuthField, AuthMessage, AuthPanel, Divider, GoogleButton, TextLink } from '@/components/auth/auth-ui';
import { authErrorMessage } from '@/lib/auth-messages';

function callbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setLoading(true);
    const { error } = await supabaseBrowser()
      .auth.signInWithPassword({ email: email.trim(), password })
      .catch((err: Error) => ({ error: err }));
    if (error) {
      setError(authErrorMessage(error.message));
      setLoading(false);
      busy.current = false;
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function onGoogle() {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setLoading(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(next), queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      setError(authErrorMessage(error.message));
      setLoading(false);
      busy.current = false;
    }
  }

  return (
    <AuthPanel
      title="Sign in"
      footer={
        <>
          New here? <TextLink href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</TextLink>
        </>
      }
    >
      <GoogleButton onClick={onGoogle} disabled={loading} />
      <Divider />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <AuthField
          label="Email"
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Password"
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aside={
            <TextLink href={`/forgot-password?next=${encodeURIComponent(next)}`} className="text-2xs">
              Forgot password?
            </TextLink>
          }
        />
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <Button type="submit" variant="primary" disabled={loading} className="h-9">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthPanel>
  );
}
