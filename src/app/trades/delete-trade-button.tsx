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
      className="inline-flex"
      onSubmit={(e) => {
        const ok = window.confirm('Delete this trade? This cannot be undone.');
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="tradeId" value={tradeId} />
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <button
        type="submit"
        className={`inline-flex items-center leading-none ${className ?? ''}`.trim()}
      >
        Delete
      </button>
    </form>
  );
}