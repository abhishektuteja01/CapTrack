'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

function ResetPasswordInner() {
  const router = useRouter();
  const search = useSearchParams();

  const next = useMemo(() => search.get('next') || '/dashboard', [search]);

  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      setChecking(true);
      const supabase = supabaseBrowser();

      // If the user clicked the recovery link, Supabase should have established a session
      // via our /auth/callback route (code exchange + cookies).
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;

      setHasRecoverySession(Boolean(data.user));
      setChecking(false);
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (newPassword.length < 8) {
      setStatus('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus('Password updated. Redirecting…');
      router.replace(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="w-full">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-zinc-600">Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <p className="mt-1 text-sm text-zinc-600">Set a new password for your account.</p>

      {!hasRecoverySession ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          Open the reset-password link from your email in this same browser. If you just opened it,
          try refreshing this page.
          <div className="mt-3">
            <a className="text-zinc-800 underline" href={`/forgot-password?next=${encodeURIComponent(next)}`}>
              Send another reset email
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">New password</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
            {loading ? 'Updating…' : 'Set new password'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <a className="text-zinc-700 underline" href={`/login?next=${encodeURIComponent(next)}`}>
              Back to sign in
            </a>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <p className="text-sm text-zinc-600">Loading…</p>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}