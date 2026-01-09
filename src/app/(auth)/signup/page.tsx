'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

function getRedirectTo(nextPath: string) {
  if (typeof window === 'undefined') return nextPath;
  const origin = window.location.origin;
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

function normalizePhone(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  // Keep a very light normalization; we store it as metadata only.
  // Remove spaces and common separators.
  return trimmed.replace(/[\s().-]/g, '');
}

function SignupInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = useMemo(() => search.get('next') || '/dashboard', [search]);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onGoogle() {
    setStatus(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectTo(next),
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (password.length < 8) {
      setStatus('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const cleanedPhone = normalizePhone(phone);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            ...(cleanedPhone ? { phone: cleanedPhone } : {}),
          },
          // Email confirmation / magic link will come back through our callback route.
          emailRedirectTo: getRedirectTo(next),
        },
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      // If identities is empty, Supabase is signaling the email already exists
      // (commonly when the user previously signed in with Google).
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setStatus(
          "This email already has an account (likely created via Google). Please sign in with Google, or use 'Forgot password' to set a password.",
        );
        return;
      }

      setStatus(
        'Account created. Please check your inbox to confirm your email, then sign in.',
      );

      // If confirmations are disabled, a session may already exist — route into the app.
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        router.replace(next);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold">Create account</h1>

      <button
        type="button"
        onClick={onGoogle}
        disabled={loading}
        className="mt-6 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
      >
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-500">or</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <form onSubmit={onSignup} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            type="text"
            autoComplete="name"
            placeholder="Abhishek"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Phone (optional)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500">Stored as profile metadata only.</p>
        </div>

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

        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
          <p className="mt-1 text-xs text-zinc-500">Minimum 8 characters.</p>
        </div>

        <div>
          <label className="text-sm font-medium">Confirm password</label>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
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
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <a className="text-zinc-700 underline" href={`/login?next=${encodeURIComponent(next)}`}>
          Back to sign in
        </a>
        <a className="text-zinc-700 underline" href={`/forgot-password?next=${encodeURIComponent(next)}`}>
          Forgot password?
        </a>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <p className="text-sm text-zinc-600">Loading…</p>
        </div>
      }
    >
      <SignupInner />
    </Suspense>
  );
}
