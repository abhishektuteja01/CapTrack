import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Inline status line. Tone is carried by a label as well as color. */
export function Notice({
  tone = 'warn',
  label,
  children,
  className,
}: {
  tone?: 'warn' | 'neg' | 'info';
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    warn: 'border-warn/30 bg-warn-soft text-warn',
    neg: 'border-neg/30 bg-neg-soft text-neg',
    info: 'border-line bg-surface text-ink-2',
  };
  return (
    <div role="status" className={cn('flex flex-wrap gap-x-2 rounded-md border px-3 py-2 text-[13px]', tones[tone], className)}>
      <span className="font-semibold">{label}</span>
      <span className="text-ink-2">{children}</span>
    </div>
  );
}
