'use client';

import { useEffect, useRef, useState } from 'react';

export type SymbolSuggestion = {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'fund' | 'other';
  exchange?: string;
};

export default function SymbolAutocomplete({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (s: SymbolSuggestion) => void;
}) {
  const [query, setQuery] = useState(value ?? '');
  const [results, setResults] = useState<SymbolSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const justSelectedRef = useRef(false);
  const programmaticSetRef = useRef(false);

  useEffect(() => {
    programmaticSetRef.current = true;
    setQuery(value ?? '');
  }, [value]);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (programmaticSetRef.current) {
      programmaticSetRef.current = false;
      setOpen(false);
      return;
    }

    if (!query || query.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

    setLoading(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as SymbolSuggestion[];
        setResults(json);
        setOpen(true);
      } catch {
        // ignore aborts / network errors
      } finally {
        setLoading(false);
      }
    }, 300); // debounce

    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Start typing a symbol (AAPL, BTC, SPY…)"
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:ring-1 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white dark:focus:bg-black dark:focus:ring-white"
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />

      {open && (loading || results.length > 0) ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg ring-1 ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
          {loading ? (
            <div className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">Searching…</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.symbol}-${r.exchange ?? ''}`}
                type="button"
                onClick={() => {
                  justSelectedRef.current = true;
                  setResults([]);
                  setOpen(false);
                  setQuery(r.symbol);
                  onSelect(r);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white">{r.symbol}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{r.name}</div>
                </div>
                <div className="text-right text-xs text-zinc-400 dark:text-zinc-500">
                  <div className="uppercase tracking-wider">{r.type}</div>
                  {r.exchange ? <div>{r.exchange}</div> : null}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}