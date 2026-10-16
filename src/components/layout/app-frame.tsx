import type { ReactNode } from 'react';
import Link from 'next/link';
import UserMenu from '@/components/layout/user-menu';
import { BottomNav, SideNav } from '@/components/layout/nav-links';

/** Sidebar on desktop; on phones a slim top bar and a tab bar along the bottom. */
export function AppFrame({ name, email, children }: { name: string; email?: string | null; children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[184px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface md:flex">
        <Link href="/dashboard" className="px-4 pb-3 pt-4 text-sm font-semibold tracking-[-0.01em] text-ink">
          CapTrack
        </Link>
        <SideNav />
        <div className="mt-auto border-t border-line py-2">
          <UserMenu name={name} email={email} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface md:hidden">
        <div className="flex h-11 items-center justify-between px-4">
          <Link href="/dashboard" className="text-sm font-semibold text-ink">
            CapTrack
          </Link>
          <UserMenu name={name.split(' ')[0]} compact />
        </div>
      </header>

      {/* Bottom padding clears the phone tab bar. */}
      <main className="min-w-0 px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-4 md:px-5 md:py-5">{children}</main>
      <BottomNav />
    </div>
  );
}
