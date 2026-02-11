'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type UserMenuProps = {
  user: {
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
};

export default function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const metadata = user.user_metadata ?? {};
  const displayName =
    typeof metadata.display_name === 'string'
      ? metadata.display_name
      : typeof metadata.full_name === 'string'
        ? metadata.full_name
        : user.email?.split('@')[0] ?? 'User';

  const firstName = displayName.split(' ')[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Hi, {firstName}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-40 rounded-md border border-zinc-200 bg-white shadow-sm"
        >
          <Link
            href="/settings"
            role="menuitem"
            className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>

          <a
            href="/auth/logout"
            role="menuitem"
            className="block px-3 py-2 text-sm text-red-600 hover:bg-zinc-100"
          >
            Logout
          </a>
        </div>
      )}
    </div>
  );
}
