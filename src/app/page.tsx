import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getUser } from '@/lib/supabase/auth';

export default async function Home() {
  const user = await getUser();
  if (user) redirect('/dashboard');

  return (
    <div className="relative min-h-dvh overflow-hidden bg-white text-zinc-900">
      {/* subtle animated background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-zinc-100 blur-3xl motion-safe:animate-pulse" />
        <div className="absolute top-40 -right-24 h-80 w-80 rounded-full bg-zinc-50 blur-3xl motion-safe:animate-pulse" />
        <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-zinc-100 blur-3xl motion-safe:animate-pulse" />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-xl items-center px-4">
        <section className="w-full space-y-6 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex items-center justify-center gap-3">
              <img
                src="/icons/apple-touch-icon.png"
                alt="CapTrack"
                className="h-12 w-12 sm:h-10 sm:w-10"
                width={48}
                height={48}
              />
              <h1 className="text-3xl font-semibold tracking-tight">CapTrack</h1>
            </div>

            <p className="text-sm leading-relaxed text-zinc-600">
              A clean, mobile-first portfolio tracker. Add your trades once—CapTrack computes
              positions, pulls live prices, and shows your P&amp;L.
            </p>

            <div className="flex flex-wrap justify-center gap-2 pt-1 text-xs text-zinc-600">
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">Trades → Positions</span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">Live prices</span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">Multi-currency</span>
            </div>
          </div>

          <div className="mx-auto grid max-w-sm gap-3 sm:grid-cols-2">
            <Link
              href="/login"
              className="rounded-2xl bg-black px-5 py-3 text-center text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.99]"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-center text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 active:scale-[0.99]"
            >
              Create account
            </Link>
          </div>

          <p className="text-xs text-zinc-500">
            Tip: Add CapTrack to your iPhone Home Screen for an app-like experience.
          </p>
        </section>
      </main>
    </div>
  );
}
