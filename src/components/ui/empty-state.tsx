import type { ReactNode } from 'react';

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-8">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="max-w-prose text-[13px] text-ink-2">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
