'use client';

import { useId, useMemo, useSyncExternalStore } from 'react';
import { inputClass } from '@/components/trades/symbol-autocomplete';
import { cn } from '@/lib/utils';

/** Pick any ISO currency by code or name. Uses the browser's own currency names. */
export function CurrencyPicker({
  id,
  name,
  value,
  onChange,
  className,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  const listId = useId();
  // Currency lists and names differ between Node and browsers, so build them in the browser only.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const options = useMemo(() => {
    if (!isClient) return [];
    let codes: string[] = [];
    try {
      codes = Intl.supportedValuesOf('currency');
    } catch {
      codes = ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD'];
    }
    const names = new Intl.DisplayNames(['en'], { type: 'currency' });
    return codes.map((c) => ({ code: c, label: names.of(c) ?? c }));
  }, [isClient]);
  const label = options.find((o) => o.code === value)?.label;

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={name}
        list={listId}
        value={value}
        maxLength={3}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        className={cn(inputClass, 'num w-24 uppercase', className)}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </datalist>
      <span className="truncate text-[13px] text-ink-2">{label ?? (isClient && value.length === 3 ? 'Unknown code' : '')}</span>
    </div>
  );
}
