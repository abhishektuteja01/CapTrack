'use client';

import { deleteTradeAction } from '@/app/(app)/trades/actions';

export default function DeleteTradeButton({
  tradeId,
  className,
}: {
  tradeId: string;
  className?: string;
}) {
  return (
    <form
      action={deleteTradeAction}
      className="inline-flex"
      onSubmit={(e) => {
        const ok = window.confirm('Delete this trade? This cannot be undone.');
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="tradeId" value={tradeId} />
      <button
        type="submit"
        className={`inline-flex items-center leading-none ${className ?? ''}`.trim()}
      >
        Delete
      </button>
    </form>
  );
}