import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LayoutDashboard, ArrowRightLeft } from 'lucide-react';

import { getUser } from '@/lib/supabase/auth';
import UserMenu from '@/components/layout/user-menu';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="relative min-h-dvh w-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black font-sans">
      {/* Subtle Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-zinc-200/50 blur-3xl dark:bg-zinc-900/40 opacity-50" />
        <div className="absolute top-[20%] -left-[10%] w-[400px] h-[400px] rounded-full bg-zinc-200/50 blur-3xl dark:bg-zinc-900/40 opacity-50" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/50 bg-white/80 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/80 supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {/* Left: Brand */}
          <Link href="/dashboard" className="flex items-center gap-2 group" aria-label="CapTrack">
            <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold transition-transform group-hover:scale-105 dark:bg-white dark:text-black">
              C
            </div>
            <span className="text-base font-semibold tracking-tight hidden sm:inline-block">CapTrack</span>
          </Link>

          {/* Right: Desktop nav + User menu */}
          <div className="ml-auto flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="group flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-all dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/trades"
                className="group flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-all dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Trades
              </Link>
            </nav>
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 pb-24 md:pb-12 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Bottom nav (mobile only) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/80 bg-white/90 backdrop-blur-lg md:hidden dark:border-zinc-800/80 dark:bg-zinc-900/90 pb-safe">
        <div className="mx-auto grid max-w-md grid-cols-2 px-6 py-2">
          <Link
            href="/dashboard"
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 transition-all dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px] font-medium">Dashboard</span>
          </Link>
          <Link
            href="/trades"
            className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 transition-all dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <ArrowRightLeft className="h-5 w-5" />
            <span className="text-[10px] font-medium">Trades</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}