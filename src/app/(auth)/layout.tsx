import type { ReactNode } from 'react';
import Link from 'next/link';
import { AuroraBackground } from '@/components/ui/aurora-background';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuroraBackground>
      <div className="relative w-full h-full min-h-screen flex flex-col items-center justify-center p-4 text-zinc-900 selection:bg-zinc-900 selection:text-white">
        <main className="relative z-10 w-full max-w-md flex flex-col items-center">
          {/* Branding - Centered above content */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <Link href="/" className="flex flex-col items-center gap-3 group">
              <div className="h-12 w-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg transition-transform group-hover:scale-105">
                C
              </div>
              <span className="font-bold text-2xl tracking-tight">CapTrack</span>
            </Link>
          </div>

          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </AuroraBackground>
  );
}