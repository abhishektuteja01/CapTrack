import Link from 'next/link';
import Image from 'next/image';
import { AuroraBackground } from '@/components/ui/aurora-background';

export default function LandingPage() {
  return (
    <AuroraBackground>
      <div className="relative w-full text-zinc-900 selection:bg-zinc-900 selection:text-white font-sans">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-100 bg-white/60 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="h-8 w-8 relative flex items-center justify-center transition-transform group-hover:scale-105">
                  <Image src="/icons/icon-192.png" alt="CapTrack Logo" fill className="object-contain" />
                </div>
                <span className="text-xl font-bold tracking-tight">CapTrack</span>
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="/login"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-zinc-800 hover:scale-105 active:scale-95"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="pt-32 pb-16 px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-zinc-900 mb-8 mt-12">
              The minimal way to track your <span className="text-zinc-400">capital.</span>
            </h1>
            <p className="text-lg sm:text-xl text-zinc-500 mb-12 max-w-2xl mx-auto leading-relaxed">
              Beautifully simple portfolio tracking for modern investors.
              No clutter, no distractions, just your growth.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-full bg-zinc-900 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 hover:scale-105 active:scale-95"
              >
                Start tracking now
              </Link>
            </div>
          </div>

          {/* Minimal Feature List */}
          <section className="mt-32 max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div>
                <h3 className="text-xl font-bold mb-3 text-zinc-900">Real-time Data</h3>
                <p className="text-zinc-500">Live price updates for US stocks, Indian stocks, and crypto.</p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3 text-zinc-900">Multi-Currency</h3>
                <p className="text-zinc-500">Track your portfolio in USD or INR with automatic FX conversion.</p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3 text-zinc-900">Clean Insights</h3>
                <p className="text-zinc-500">Simple P&L tracking and position analysis without the noise.</p>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-20 border-t border-zinc-100 py-12 px-4 text-center">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 relative flex items-center justify-center">
                <Image src="/logo-v2.png" alt="CapTrack Logo" fill className="object-contain" />
              </div>
              <span className="text-sm font-semibold text-zinc-900">CapTrack</span>
            </div>
            <p className="text-sm text-zinc-400">© 2026 CapTrack. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </AuroraBackground>
  );
}
