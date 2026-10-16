// src/lib/labels.ts
// Display names shared by server and client components.

import type { CashKind } from '@/lib/domain/portfolio/money';

export const CASH_KIND_LABELS: Record<CashKind, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  dividend: 'Dividend',
  interest: 'Interest',
  fee: 'Charge',
};
