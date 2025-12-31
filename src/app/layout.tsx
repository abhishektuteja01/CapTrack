import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CapTrack',
  description: 'Mobile-first portfolio tracking: trades → positions → performance.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-dvh bg-white text-zinc-900">
          {/* Top bar */}
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-base font-semibold tracking-tight">
                CapTrack
              </Link>

              {/* Desktop / tablet nav */}
              <nav className="hidden items-center gap-4 text-sm md:flex">
                <Link href="/dashboard" className="text-zinc-700 hover:text-zinc-900">
                  Dashboard
                </Link>
                <Link href="/trades" className="text-zinc-700 hover:text-zinc-900">
                  Trades
                </Link>
                <Link href="/settings" className="text-zinc-700 hover:text-zinc-900">
                  Settings
                </Link>
              </nav>
            </div>
          </header>

          {/* Page content */}
          <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 md:pb-8">{children}</main>

          {/* Mobile bottom nav (mobile-first) */}
          <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-zinc-200 bg-white md:hidden">
            <div className="mx-auto grid max-w-3xl grid-cols-3 px-2 py-2 text-sm">
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
              >
                Dashboard
              </Link>
              <Link
                href="/trades"
                className="flex items-center justify-center rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
              >
                Trades
              </Link>
              <Link
                href="/settings"
                className="flex items-center justify-center rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
              >
                Settings
              </Link>
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
