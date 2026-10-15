'use client';

import { useState } from 'react';
import type { Slice } from '@/lib/portfolio';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'platform', label: 'Platform' },
  { key: 'currency', label: 'Currency' },
  { key: 'type', label: 'Type' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const TYPE_LABEL: Record<string, string> = {
  stock: 'Stocks',
  etf: 'ETFs',
  mutual_fund: 'Mutual funds',
  crypto: 'Crypto',
  cash: 'Cash',
};

/** Where the money sits. Bars show weight; one hue because this is magnitude, not identity. */
export function AllocationPanel({
  allocation,
  currency,
}: {
  allocation: Record<Tab, Slice[]>;
  currency: string;
}) {
  const [tab, setTab] = useState<Tab>('platform');
  const rows = allocation[tab];
  const max = Math.max(...rows.map((r) => r.weight), 1);

  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label="Group by" className="flex gap-1 border-b border-line px-3 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-2xs text-ink-3 hover:text-ink',
              tab === t.key && 'bg-accent-soft font-medium text-accent'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length ? (
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line last:border-b-0">
                <td className="h-8 max-w-32 truncate pl-3 pr-2">{tab === 'type' ? TYPE_LABEL[r.key] ?? r.key : r.key}</td>
                <td className="w-full px-2">
                  <span
                    className="block h-1.5 rounded-sm bg-accent/75"
                    style={{ width: `${(r.weight / max) * 100}%` }}
                    aria-hidden="true"
                  />
                </td>
                <td className="num whitespace-nowrap px-2 text-right">{r.weight.toFixed(1)}%</td>
                <td className="num whitespace-nowrap pr-3 text-right text-ink-2">{money(r.value, currency, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-3 py-6 text-[13px] text-ink-3">Nothing priced yet.</p>
      )}
    </div>
  );
}
