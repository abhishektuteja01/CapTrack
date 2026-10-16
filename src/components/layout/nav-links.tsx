'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { sheetHref } from '@/lib/sheet-links';
import { cn } from '@/lib/utils';

export const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/holdings', label: 'Holdings' },
  { href: '/trades', label: 'Activity' },
  { href: '/pnl', label: 'P&L' },
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

/** 20px line icons for the phone tab bar. */
const ICONS: Record<string, ReactNode> = {
  '/dashboard': <path d="M3 12h4l3-8 4 16 3-8h4" />,
  '/holdings': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </>
  ),
  '/trades': <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  '/pnl': <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** Pages that render the add/edit panels; anywhere else the + opens them on the Overview. */
function hostsSheets(pathname: string) {
  return ['/dashboard', '/holdings', '/trades', '/pnl'].includes(pathname) || pathname.startsWith('/holdings/');
}

const addItem =
  'flex h-11 cursor-default items-center rounded-sm px-3 text-sm text-ink outline-none data-[highlighted]:bg-subtle';

/** The + in the middle of the tab bar: add a trade or a cash entry from any page. */
function AddMenu() {
  const pathname = usePathname();
  const params = useSearchParams();
  const base = hostsSheets(pathname) ? pathname : '/dashboard';
  const current = hostsSheets(pathname) ? params : new URLSearchParams();
  return (
    <Menu.Root>
      <Menu.Trigger aria-label="Add" className="flex items-center justify-center outline-none">
        <span className="flex size-10 items-center justify-center rounded-md bg-accent text-white">
          <Icon>
            <path d="M12 5v14M5 12h14" />
          </Icon>
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content side="top" align="center" sideOffset={8} className="z-50 min-w-52 rounded-md border border-line bg-surface p-1">
          <Menu.Item asChild>
            <Link href={sheetHref(base, current, { trade: 'new' })} scroll={false} className={addItem}>
              Add trade
            </Link>
          </Menu.Item>
          <Menu.Item asChild>
            <Link href={sheetHref(base, current, { cash: 'new' })} scroll={false} className={addItem}>
              Add cash entry
            </Link>
          </Menu.Item>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item asChild>
            <Link href="/trades/import" className={cn(addItem, 'text-ink-2')}>
              Import a CSV
            </Link>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Tab bar fixed to the bottom of the screen on phones, with the + in the middle. Settings is in the name menu. */
export function BottomNav() {
  const pathname = usePathname();
  const tabs = NAV.filter((item) => item.href !== '/settings');
  const tab = (item: (typeof tabs)[number]) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn('flex flex-col items-center justify-center gap-0.5 text-[11px]', active ? 'font-medium text-accent' : 'text-ink-3')}
      >
        <Icon>{ICONS[item.href]}</Icon>
        {item.label}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden [&>*]:h-14"
    >
      {tabs.slice(0, 2).map(tab)}
      <AddMenu />
      {tabs.slice(2).map(tab)}
    </nav>
  );
}
