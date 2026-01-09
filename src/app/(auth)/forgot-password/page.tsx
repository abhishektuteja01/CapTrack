'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

function getRedirectTo(nextPath: string) {
  if (typeof window === 'undefined') return nextPath;
  const origin = window.location.origin;
  // After code exchange in /auth/callback, land on reset-password.
  return `${origin}/auth/callback?next=${encodeURIComponent(`/reset-password?next=${encodeURIComponent(nextPath)}`)}`;
}

function ForgotPasswordInner() {
  const search = useSearchParams();
  const next = useMemo(() => search.get('next') || '/dashboard', [search]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getRedirectTo(next),
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus('Password reset email sent. Open the link to set a new password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <p className="mt-1 text-sm text-zinc-600">We’ll email you a link to reset your password.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
        </div>

        {status ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
            {status}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Sending…' : 'Send reset email'}
        </button>

        <div className="flex items-center justify-between text-sm">
          <a className="text-zinc-700 underline" href={`/login?next=${encodeURIComponent(next)}`}>
            Back to sign in
          </a>
          <a className="text-zinc-700 underline" href={`/signup?next=${encodeURIComponent(next)}`}>
            Create account
          </a>
        </div>
      </form>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <p className="text-sm text-zinc-600">Loading…</p>
        </div>
      }
    >
      <ForgotPasswordInner />
    </Suspense>
  );
}
