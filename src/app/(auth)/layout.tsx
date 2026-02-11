import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white dark:bg-black dark:text-zinc-100 dark:selection:bg-white dark:selection:text-black">

      {/* Background Gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-gradient-to-r from-zinc-100 to-zinc-50 blur-3xl dark:from-zinc-900 dark:to-black opacity-60" />
        <div className="absolute -right-[10%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-gradient-to-l from-zinc-100 to-white blur-3xl dark:from-zinc-900 dark:to-black opacity-50" />
      </div>

      {/* Logo / Home Link */}
      <div className="absolute top-8 left-8 z-50">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-8 w-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold transition-transform group-hover:scale-105 dark:bg-white dark:text-black">
            C
          </div>
          <span className="font-semibold text-lg tracking-tight">CapTrack</span>
        </Link>
      </div>

      <main className="relative z-10 w-full max-w-md px-4">
        {children}
      </main>
    </div>
  );
}