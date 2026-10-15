// src/lib/auth-messages.ts
// Shared by auth pages (server) and auth forms (client).

/** Only same-site paths, so `?next=` can't send people to another site. */
export function safeNext(value: string | null | undefined, fallback = '/dashboard') {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

/** Supabase auth errors in plain words. Unknown errors get a generic line rather than raw text. */
export function authErrorMessage(message: string | undefined | null) {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password don’t match an account.';
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the link we sent.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Sign in instead.';
  if (m.includes('password should be') || m.includes('weak password')) return 'Use a longer password: at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('same password')) return 'Choose a password different from your current one.';
  if (m.includes('network') || m.includes('fetch')) return 'Couldn’t reach the server. Check your connection.';
  return 'Something went wrong. Try again in a moment.';
}
