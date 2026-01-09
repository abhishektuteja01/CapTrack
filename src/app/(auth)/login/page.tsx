'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

function getRedirectTo(nextPath: string) {
  // Works on localhost + Vercel preview + prod without hardcoding.
  // Uses the current origin at runtime.
  if (typeof window === 'undefined') return nextPath;
  const origin = window.location.origin;
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();

  const next = useMemo(() => search.get('next') || '/dashboard', [search]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onEmailPasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      router.replace(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn() {
    setErrorMsg(null);
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

      if (error) setErrorMsg(error.message);
      // On success, Supabase redirects away.
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="text-2xl font-semibold">Sign in</h1>
    
      <button
        type="button"
        onClick={onGoogleSignIn}
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

      <form onSubmit={onEmailPasswordSignIn} className="space-y-4">
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
            autoComplete="current-password"
            placeholder="••••••••"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900"
            required
          />
        </div>

        {errorMsg ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <a className="text-zinc-700 underline" href={`/forgot-password?next=${encodeURIComponent(next)}`}>
          Forgot password?
        </a>
        <a className="text-zinc-700 underline" href={`/signup?next=${encodeURIComponent(next)}`}>
          Create account
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-sm px-4 py-10">
          <p className="text-sm text-zinc-600">Loading…</p>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}