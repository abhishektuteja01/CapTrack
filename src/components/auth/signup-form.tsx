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

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const busy = useRef(false);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    setError(null);
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }
    busy.current = true;
    setLoading(true);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: callbackUrl(next) },
    });
    setLoading(false);
    busy.current = false;
    if (error) {
      setError(authErrorMessage(error.message));
      return;
    }
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError('This email already has an account, possibly through Google. Sign in, or use “Forgot password” to set one.');
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthPanel title="Check your email" subtitle={<>We sent a confirmation link to <span className="font-medium text-ink">{sentTo}</span>.</>}>
        <p className="text-[13px] text-ink-2">Open it on this device to finish creating your account. It can take a minute to arrive; check spam if it doesn’t.</p>
        <TextLink href="/login" className="text-[13px]">
          Back to sign in
        </TextLink>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      title="Create an account"
      subtitle="Free. Your trades are visible only to you."
      footer={
        <>
          Already have an account? <TextLink href={`/login?next=${encodeURIComponent(next)}`}>Sign in</TextLink>
        </>
      }
    >
      <GoogleButton onClick={onGoogle} disabled={loading} label="Sign up with Google" />
      <Divider />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <AuthField label="Name" id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
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
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aside={<span className="text-2xs text-ink-3">8+ characters</span>}
        />
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <Button type="submit" variant="primary" disabled={loading} className="h-9">
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthPanel>
  );
}
