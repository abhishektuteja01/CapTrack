'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type SymbolSuggestion = {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'fund' | 'other';
  exchange?: string;
};

/**
 * Symbol input with Yahoo suggestions. Typing alone is a valid value; picking a suggestion
 * also fills the asset type and currency. Arrow keys move, Enter picks, Escape closes.
 */
export default function SymbolAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (text: string) => void;
  onSelect: (s: SymbolSuggestion) => void;
  invalid?: boolean;
}) {
  const [results, setResults] = useState<SymbolSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false);
  const listId = useId();

  useEffect(() => {
    // Only search after the user types, not when a value is set programmatically.
    if (!typed.current) return;
    const q = value.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = (await res.json()) as SymbolSuggestion[];
        setResults(json);
        setActive(-1);
        setOpen(true);
      } catch {
        // aborted or offline: keep what the user typed
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  function pick(s: SymbolSuggestion) {
    typed.current = false;
    setOpen(false);
    setResults([]);
    onSelect(s);
  }

  const showList = open && value.trim() !== '' && (loading || results.length > 0);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => {
          typed.current = true;
          const text = e.target.value.toUpperCase();
          if (!text.trim()) {
            setResults([]);
            setOpen(false);
          }
          onChange(text);
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="AAPL, RELIANCE.NS, BTC…"
        className={cn(inputClass, 'num uppercase placeholder:normal-case')}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-surface py-1"
        >
          {loading && !results.length ? <li className="px-3 py-2 text-2xs text-ink-3">Searching…</li> : null}
          {results.map((r, i) => (
            <li
              key={`${r.symbol}-${r.exchange ?? ''}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-default items-baseline justify-between gap-3 px-3 py-1.5',
                i === active && 'bg-subtle'
              )}
            >
              <span className="min-w-0">
                <span className="num text-[13px] font-semibold">{r.symbol}</span>
                <span className="ml-2 truncate text-2xs text-ink-3">{r.name}</span>
              </span>
              <span className="shrink-0 text-2xs text-ink-3">{[r.exchange, r.type].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export const inputClass =
  'h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-accent focus:ring-1 focus:ring-accent aria-[invalid=true]:border-neg';
