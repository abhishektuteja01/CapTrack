import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A white tile separated from the page by a hairline. No shadow, no rounding beyond 3px. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('min-w-0 rounded-md border border-line bg-surface', className)}>{children}</section>;
}

export function PanelHeader({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-3 py-1.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="condensed text-xs font-semibold uppercase tracking-[0.04em] text-ink">{title}</h2>
        {meta ? <span className="truncate text-2xs text-ink-3">{meta}</span> : null}
      </div>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </div>
  );
}
