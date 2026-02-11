'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useDebounce } from 'use-debounce';

export default function TradeFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initialSearch = searchParams.get('search') ?? '';
  const [text, setText] = useState(initialSearch);
  const [query] = useDebounce(text, 500);

  useEffect(() => {
    // Only update if query actually changed from current param
    if (query === searchParams.get('search')) return;
    // Also skip if query is empty and param is missing
    if (!query && !searchParams.has('search')) return;

    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set('search', query);
    } else {
      params.delete('search');
    }
    // Reset page on search
    params.delete('page');

    startTransition(() => {
      router.replace(`/trades?${params.toString()}`);
    });
  }, [query, router, searchParams]);

  return (
    <div className="relative w-full max-w-sm">
      <div className="relative">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search symbol..."
          className="peer block w-full rounded-full border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white dark:focus:border-zinc-700"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 peer-focus:text-zinc-900 dark:peer-focus:text-zinc-200">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
      </div>
    </div>
  );
}
