'use client';

import Link from 'next/link';
import * as Menu from '@radix-ui/react-dropdown-menu';

type UserMenuProps = {
  name: string;
  email?: string | null;
  compact?: boolean;
};

const item =
  'block cursor-default rounded-sm px-2.5 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-subtle max-md:py-3 max-md:text-sm';

export default function UserMenu({ name, email, compact }: UserMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={
          compact
            ? 'flex h-9 items-center rounded-md px-3 text-[13px] text-ink-2 hover:bg-subtle'
            : 'flex w-full flex-col items-start rounded-md px-4 py-2 text-left hover:bg-hover'
        }
      >
        {compact ? (
          name
        ) : (
          <>
            <span className="text-[13px] font-medium text-ink">{name}</span>
            {email ? <span className="max-w-full truncate text-2xs text-ink-3">{email}</span> : null}
          </>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={compact ? 'end' : 'start'}
          side={compact ? 'bottom' : 'top'}
          sideOffset={4}
          className="z-50 min-w-44 rounded-md border border-line bg-surface p-1"
        >
          <Menu.Item asChild>
            <Link href="/settings" className={item}>
              Settings
            </Link>
          </Menu.Item>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item asChild>
            <a href="/auth/logout" className={item}>
              Sign out
            </a>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
