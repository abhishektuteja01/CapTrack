'use client';

import { deleteTradeAction } from './actions';

export default function DeleteTradeButton({
  tradeId,
  portfolioId,
  className,
}: {
  tradeId: string;
  portfolioId: string;
  className?: string;
}) {
  return (
    <form
      action={deleteTradeAction}
      onSubmit={(e) => {
        const ok = window.confirm('Delete this trade? This cannot be undone.');
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="tradeId" value={tradeId} />
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <button type="submit" className={className}>
        Delete
      </button>
    </form>
  );
}