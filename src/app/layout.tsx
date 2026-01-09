import type { Metadata } from 'next';
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
        <div className="min-h-dvh bg-white text-zinc-900">{children}</div>
      </body>
    </html>
  );
}
