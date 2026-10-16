import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

// latin-ext carries the rupee sign (U+20B9); without it ₹ falls back to a system font.
const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: { default: 'CapTrack', template: '%s · CapTrack' },
  applicationName: 'CapTrack',
  description:
    'Track trades across brokers and currencies. Positions, realized and unrealized P&L, and XIRR in your own base currency.',

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

export const viewport: Viewport = {
  themeColor: '#F4F5F5',
  // Lets the phone tab bar pad itself clear of the home indicator.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
