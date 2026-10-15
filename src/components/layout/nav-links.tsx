'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/holdings', label: 'Holdings' },
  { href: '/trades', label: 'Trades' },
  { href: '/settings', label: 'Settings' },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Vertical list for the desktop sidebar. */
export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col py-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'border-l-2 px-4 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink',
              active ? 'border-accent bg-accent-soft/60 font-medium text-ink' : 'border-transparent'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontal row under the mobile top bar. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-2 px-2.5 py-2 text-[13px] text-ink-2',
              active ? 'border-accent font-medium text-ink' : 'border-transparent'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
