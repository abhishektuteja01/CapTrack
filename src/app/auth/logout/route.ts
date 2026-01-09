import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

function safeNext(url: URL) {
  const nextParam = url.searchParams.get('next') ?? '/login';
  return nextParam.startsWith('/') ? nextParam : '/login';
}

async function handleLogout(request: Request) {
  const supabase = await supabaseServer();
  // Sign out best-effort; even if it fails, redirect to login.
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }

  const url = new URL(request.url);
  const next = safeNext(url);

  // After logout, we almost always want to land on /login.
  // If next is something else (e.g. /login?next=/dashboard), allow it.
  return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
}

export async function POST(request: Request) {
  return handleLogout(request);
}

export async function GET(request: Request) {
  return handleLogout(request);
}