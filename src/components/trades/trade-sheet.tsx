'use client';

import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';
import TradeForm from './trade-form';

/**
 * Side panel for adding or editing a trade without leaving the list.
 * Opened by the URL (?new or ?edit=id) so it survives refresh and the back button closes it.
 */
export function TradeSheet({
  closeHref,
  ...form
}: Omit<ComponentProps<typeof TradeForm>, 'onCancel' | 'returnTo'> & { closeHref: string }) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-line bg-surface outline-none"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Start in the first field, not on Close.
            const first = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('input[role="combobox"], input:not([type="hidden"])');
            if (first) {
              e.preventDefault();
              first.focus();
            }
          }}
        >
          <div className="flex h-11 items-center justify-between border-b border-line px-4">
            <Dialog.Title className="text-sm font-semibold">
              {form.trade ? `Edit ${form.trade.symbol} trade` : 'Add trade'}
            </Dialog.Title>
            <Dialog.Close className="rounded-sm px-2 py-1 text-2xs text-ink-3 hover:bg-subtle hover:text-ink">
              Close
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <TradeForm {...form} returnTo={closeHref} onCancel={close} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
