'use client';

import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import type { ComponentProps, ReactNode } from 'react';
import TradeForm from './trade-form';
import CashForm from './cash-form';

/**
 * Side panel opened by the URL (?trade=… or ?cash=…) so it survives refresh and the back button closes it.
 */
function Sheet({ title, closeHref, children }: { title: string; closeHref: string; children: (close: () => void) => ReactNode }) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[540px] flex-col border-l border-line bg-surface outline-none"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Start in the first field, not on Close.
            const first = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
              'select, input[role="combobox"], input:not([type="hidden"])'
            );
            if (first) {
              e.preventDefault();
              first.focus();
            }
          }}
        >
          <div className="flex h-11 items-center justify-between border-b border-line px-4">
            <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-sm px-2 py-1 text-2xs text-ink-3 hover:bg-subtle hover:text-ink">Close</Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children(close)}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TradeSheet({
  closeHref,
  ...form
}: Omit<ComponentProps<typeof TradeForm>, 'onCancel' | 'returnTo'> & { closeHref: string }) {
  const title = form.trade
    ? `Edit ${form.trade.symbol} trade`
    : form.prefill?.side === 'SELL'
      ? `Sell${form.prefill.symbol ? ` ${form.prefill.symbol}` : ''}`
      : form.prefill?.symbol
        ? `Buy ${form.prefill.symbol}`
        : 'Add trade';
  return <Sheet title={title} closeHref={closeHref}>{(close) => <TradeForm {...form} returnTo={closeHref} onCancel={close} />}</Sheet>;
}

export function CashSheet({
  closeHref,
  ...form
}: Omit<ComponentProps<typeof CashForm>, 'onCancel' | 'returnTo'> & { closeHref: string }) {
  return (
    <Sheet title={form.entry ? 'Edit cash entry' : 'Add cash entry'} closeHref={closeHref}>
      {(close) => <CashForm {...form} returnTo={closeHref} onCancel={close} />}
    </Sheet>
  );
}
