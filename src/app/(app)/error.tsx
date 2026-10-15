'use client';

import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Panel className="max-w-xl">
      <div className="flex flex-col items-start gap-2 px-4 py-6">
        <p className="text-sm font-medium">This page didn&apos;t load</p>
        <p className="text-[13px] text-ink-2">
          Your trades are safe. The database or a price source didn&apos;t respond. Try again in a moment.
        </p>
        <Button variant="secondary" onClick={reset} className="mt-1">
          Try again
        </Button>
      </div>
    </Panel>
  );
}
