import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-hover',
  ghost: 'text-ink-2 hover:bg-subtle hover:text-ink',
  danger: 'border border-line-strong bg-surface text-neg hover:bg-neg-soft',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[13px]',
  md: 'h-8 px-3 text-sm',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
