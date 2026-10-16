'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { inputClass } from './symbol-autocomplete';
import { cn } from '@/lib/utils';

/** Symbol search, platform and kind. All in the URL so filtered views can be shared and refreshed. */
export default function TradeFilters({ platforms }: { platforms: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');

  function set(next: Record<string, string | undefined>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete('page');
    startTransition(() => router.replace(`/trades${p.size ? `?${p}` : ''}`, { scroll: false }));
  }

  // Debounce the symbol search.
  useEffect(() => {
    if ((params.get('q') ?? '') === q) return;
    const t = setTimeout(() => set({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    // Phones: search on its own row, the two pickers side by side under it.
    <div className={cn('flex flex-wrap items-center gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-2', pending && 'opacity-70')}>
      <input
        aria-label="Search symbol"
        placeholder="Symbol"
        value={q}
        onChange={(e) => setQ(e.target.value.toUpperCase())}
        className={cn(inputClass, 'num h-7 w-36 uppercase placeholder:normal-case max-sm:col-span-2 max-sm:w-full')}
      />
      <select
        aria-label="Platform"
        value={params.get('platform') ?? ''}
        onChange={(e) => set({ platform: e.target.value || undefined })}
        className={cn(inputClass, 'h-7 w-auto max-sm:w-full')}
      >
        <option value="">All platforms</option>
        {platforms.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        aria-label="Kind"
        value={params.get('kind') ?? ''}
        onChange={(e) => set({ kind: e.target.value || undefined })}
        className={cn(inputClass, 'h-7 w-auto max-sm:w-full')}
      >
        <option value="">Everything</option>
        <option value="BUY">Buys</option>
        <option value="SELL">Sells</option>
        <option value="dividend">Dividends</option>
        <option value="interest">Interest</option>
        <option value="deposit">Deposits</option>
        <option value="withdrawal">Withdrawals</option>
        <option value="fee">Charges</option>
      </select>
    </div>
  );
}
