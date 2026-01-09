import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getUser } from '@/lib/supabase/auth';
import UserMenu from '@/components/layout/user-menu';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          {/* Left: Brand */}
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="CapTrack">
            <img
              src="/icons/apple-touch-icon.png"
              alt="CapTrack"
              className="h-7 w-7"
              width={28}
              height={28}
            />
            <span className="text-base font-semibold tracking-tight">CapTrack</span>
          </Link>

          {/* Right: Desktop nav + User menu */}
          <div className="ml-auto flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                Dashboard
              </Link>
              <Link
                href="/trades"
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                Trades
              </Link>
            </nav>
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-6xl px-4 py-4 pb-20 md:pb-6">{children}</main>

      {/* Bottom nav (mobile only) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-2 px-2 py-2 text-sm">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-center font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Dashboard
          </Link>
          <Link
            href="/trades"
            className="rounded-md px-3 py-2 text-center font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Trades
          </Link>
        </div>
      </nav>
    </div>
  );
}