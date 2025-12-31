

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

  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
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
        className="w-full rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />

      {open && (loading || results.length > 0) ? (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-sm">
          {loading ? (
            <div className="px-3 py-2 text-xs text-zinc-500">Searching…</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.symbol}-${r.exchange ?? ''}`}
                type="button"
                onClick={() => {
                  setQuery(r.symbol);
                  setOpen(false);
                  onSelect(r);
                }}
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <div>
                  <div className="font-medium text-zinc-900">{r.symbol}</div>
                  <div className="text-xs text-zinc-600">{r.name}</div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div>{r.type}</div>
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