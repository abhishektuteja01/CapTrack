import Link from 'next/link';
import { cn, touch } from '@/lib/utils';

/** Scope the page to one broker. Links, so it works without JS and keeps the URL shareable. */
export function PlatformFilter({
  platforms,
  current,
  basePath = '/dashboard',
}: {
  platforms: string[];
  current?: string;
  basePath?: string;
}) {
  if (platforms.length < 2) return null;
  const items = [{ label: 'All platforms', href: basePath, active: !current }].concat(
    platforms.map((p) => ({
      label: p,
      href: `${basePath}?platform=${encodeURIComponent(p)}`,
      active: current === p,
    }))
  );
  return (
    <nav aria-label="Platform" className="flex max-w-full gap-0.5 overflow-x-auto rounded-md border border-line bg-surface p-0.5">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? 'true' : undefined}
          className={cn(
            'whitespace-nowrap rounded-sm px-2 py-0.5 text-2xs text-ink-2 hover:text-ink', touch,
            i.active && 'bg-accent-soft font-medium text-accent'
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
