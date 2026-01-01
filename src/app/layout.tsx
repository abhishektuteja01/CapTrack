import type { Metadata } from 'next';
import Image from 'next/image';
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
  applicationName: 'CapTrack',
  description: 'Mobile-first portfolio tracking: trades → positions → performance.',

  // iOS Add to Home Screen
  appleWebApp: {
    capable: true,
    title: 'CapTrack',
    statusBarStyle: 'default',
  },

  // iOS primarily uses apple-touch-icon
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
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
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 md:max-w-6xl md:px-6 lg:px-8">
              <Link href="/" className="flex items-center">
                <Image
                  src="/logo-v2.png"
                  alt="CapTrack"
                  width={120}
                  height={28}
                  priority
                />
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
          <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 md:max-w-6xl md:px-6 md:pb-8 lg:px-8">
            {children}
          </main>

          {/* Mobile bottom nav (mobile-first) */}
          <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-zinc-200 bg-white md:hidden">
            <div className="mx-auto grid w-full max-w-3xl grid-cols-3 px-2 py-2 text-sm md:max-w-6xl md:px-6 lg:px-8">
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
