'use client';

import { useState, type ReactNode } from 'react';

/** On phones, a long table shows its first 5 rows and a "Show all" button. Desktop always shows every row. */
export function ShowMore({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count <= 5) return children;
  return (
    <>
      <div className={open ? undefined : 'max-sm:[&_tbody>tr:nth-child(n+6)]:hidden'}>{children}</div>
      {open ? null : (
        <button type="button" onClick={() => setOpen(true)} className="h-11 w-full border-t border-line text-[13px] text-accent sm:hidden">
          Show all {count}
        </button>
      )}
    </>
  );
}
