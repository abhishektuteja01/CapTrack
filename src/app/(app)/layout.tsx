import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LayoutDashboard, ArrowRightLeft } from 'lucide-react';

import { getUser } from '@/lib/supabase/auth';
import UserMenu from '@/components/layout/user-menu';
import { AuroraBackground } from '@/components/ui/aurora-background';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <AuroraBackground showRadialGradient={false}>
      <div className="relative w-full h-full text-zinc-900 selection:bg-zinc-900 selection:text-white font-sans flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-50 border-b border-zinc-200/50 bg-white/60 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            {/* Left: Brand */}
            <Link href="/dashboard" className="flex items-center gap-2 group" aria-label="CapTrack">
              <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold transition-transform group-hover:scale-105">
                C
              </div>
              <span className="text-base font-semibold tracking-tight hidden sm:inline-block">CapTrack</span>
            </Link>

            {/* Right: Desktop nav + User menu */}
            <div className="ml-auto flex items-center gap-4">
              <nav className="hidden md:flex items-center gap-1">
                <Link
                  href="/dashboard"
                  className="group flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100/50 hover:text-zinc-900 transition-all"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  href="/trades"
                  className="group flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100/50 hover:text-zinc-900 transition-all"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Trades
                </Link>
              </nav>
              <div className="h-6 w-px bg-zinc-200 hidden md:block" />
              <UserMenu user={user} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 pb-24 md:pb-12 sm:px-6 lg:px-8 flex-1">
          {children}
        </main>

        {/* Bottom nav (mobile only) */}
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/80 bg-white/60 backdrop-blur-lg md:hidden pb-safe">
          <div className="mx-auto grid max-w-md grid-cols-2 px-6 py-2">
            <Link
              href="/dashboard"
              className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-center text-zinc-500 hover:bg-zinc-100/50 hover:text-zinc-900 active:scale-95 transition-all"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-[10px] font-medium">Dashboard</span>
            </Link>
            <Link
              href="/trades"
              className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-center text-zinc-500 hover:bg-zinc-100/50 hover:text-zinc-900 active:scale-95 transition-all"
            >
              <ArrowRightLeft className="h-5 w-5" />
              <span className="text-[10px] font-medium">Trades</span>
            </Link>
          </div>
        </nav>
      </div>
    </AuroraBackground>
  );
}