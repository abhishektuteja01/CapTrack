'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/trades/symbol-autocomplete';
import { cn } from '@/lib/utils';

export function AuthPanel({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-md border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h1 className="text-base font-semibold">{title}</h1>
          {subtitle ? <p className="mt-1 text-[13px] text-ink-2">{subtitle}</p> : null}
        </div>
        <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
      </div>
      {footer ? <div className="px-1 text-[13px] text-ink-2">{footer}</div> : null}
    </div>
  );
}

export function AuthField({ label, id, aside, ...props }: ComponentProps<'input'> & { label: string; id: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {aside}
      </div>
      <input id={id} className={cn(inputClass, 'h-9')} {...props} />
    </div>
  );
}

export function AuthMessage({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={cn('text-[13px]', tone === 'error' ? 'text-neg' : 'text-ink-2')}>
      {children}
    </p>
  );
}

export function GoogleButton({ onClick, disabled, label = 'Continue with Google' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled} className="h-9 w-full">
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </Button>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-2xs text-ink-3">
      <span className="h-px flex-1 bg-line" />
      or with email
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function TextLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} className={cn('text-accent hover:underline', props.className)} />;
}
