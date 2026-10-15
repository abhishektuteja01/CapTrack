import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Dense data table: 32px rows, hairline rules, condensed uppercase headers, mono numbers. `wide` columns hide on phones. */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-[13px]', className)} {...props} />
    </div>
  );
}

export function Th({ className, numeric, wide, ...props }: ComponentProps<'th'> & { numeric?: boolean; wide?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'condensed h-7 whitespace-nowrap border-b border-line bg-hover px-2.5 text-2xs font-medium uppercase tracking-[0.04em] text-ink-3 first:pl-3 last:pr-3',
        numeric ? 'text-right' : 'text-left',
        wide && 'hidden sm:table-cell',
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, numeric, wide, ...props }: ComponentProps<'td'> & { numeric?: boolean; wide?: boolean }) {
  return (
    <td
      className={cn(
        'h-8 whitespace-nowrap border-b border-line px-2.5 first:pl-3 last:pr-3',
        numeric && 'num text-right',
        wide && 'hidden sm:table-cell',
        className
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('hover:bg-hover', className)} {...props} />;
}
