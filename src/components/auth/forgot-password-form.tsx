'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { AuthField, AuthMessage, AuthPanel, TextLink } from '@/components/auth/auth-ui';
import { authErrorMessage } from '@/lib/auth-messages';

export function ForgotPasswordForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // After the code exchange in /auth/callback, land on reset-password.
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/reset-password?next=${encodeURIComponent(next)}`)}`;
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (error) setError(authErrorMessage(error.message));
    else setSent(true);
  }

  return (
    <AuthPanel
      title="Reset your password"
      subtitle={sent ? undefined : 'We’ll email you a link to set a new one.'}
      footer={<TextLink href={`/login?next=${encodeURIComponent(next)}`}>Back to sign in</TextLink>}
    >
      {sent ? (
        <AuthMessage tone="info">
          If an account exists for <span className="font-medium text-ink">{email.trim()}</span>, a reset link is on its way.
        </AuthMessage>
      ) : (
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
          {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
          <Button type="submit" variant="primary" disabled={loading} className="h-9">
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthPanel>
  );
}
