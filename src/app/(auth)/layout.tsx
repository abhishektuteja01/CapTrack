import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-12 items-center px-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-ink">
          CapTrack
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[8vh]">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
