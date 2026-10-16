// src/lib/domain/portfolio/money.ts
// Where the money went: totals bought and sold, net invested, income, charges, deposits and
// cash balances per platform. Pure; amounts convert to the base currency at each entry's date.

import { platformName, type FxLookup, type TradeFlow } from './positions';
import type { CashFlow } from './xirr';

export type CashKind = 'deposit' | 'withdrawal' | 'dividend' | 'interest' | 'fee';

export const CASH_KINDS: CashKind[] = ['deposit', 'withdrawal', 'dividend', 'interest', 'fee'];

export type CashEntryLike = {
  id?: string;
  occurredAt: string;
  kind: CashKind;
  amount: number; // positive
  currency: string;
  platform?: string;
  assetSymbol?: string | null;
  assetType?: string | null;
};

/** +1 when the entry adds cash to the account, −1 when it takes cash out. */
export function cashSign(kind: CashKind) {
  return kind === 'withdrawal' || kind === 'fee' ? -1 : 1;
}

export type MoneySummary = {
  /** Paid for buys (and options premiums), fees included. */
  bought: number;
  /** Received from sells and option settlements, fees deducted. */
  sold: number;
  /** Futures P&L settled in cash (closed contracts). */
  futures: number;
  /** bought − sold − futures: money still committed to the market. Negative once you've taken out more than you put in. */
  netInvested: number;
  dividends: number;
  interest: number;
  /** Standalone charges logged as cash entries (account fees, DP charges). Trade fees are already in bought/sold. */
  charges: number;
  deposits: number;
  withdrawals: number;
  /** True when some amount had no exchange rate and was left out. */
  partial: boolean;
};

function dateOf(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export function summarizeMoney(args: {
  flows: TradeFlow[];
  cash: CashEntryLike[];
  baseCurrency: string;
  fx: FxLookup;
}): MoneySummary {
  const s: MoneySummary = {
    bought: 0,
    sold: 0,
    futures: 0,
    netInvested: 0,
    dividends: 0,
    interest: 0,
    charges: 0,
    deposits: 0,
    withdrawals: 0,
    partial: false,
  };
  for (const f of args.flows) {
    if (f.cashBase === undefined) {
      s.partial = true;
      continue;
    }
    if (f.type === 'future') s.futures += f.cashBase;
    else if (f.cashBase < 0) s.bought -= f.cashBase;
    else s.sold += f.cashBase;
  }
  s.netInvested = s.bought - s.sold - s.futures;

  for (const c of args.cash) {
    const rate = args.fx(c.currency, args.baseCurrency, dateOf(c.occurredAt));
    if (rate === undefined) {
      s.partial = true;
      continue;
    }
    const v = c.amount * rate;
    if (c.kind === 'dividend') s.dividends += v;
    else if (c.kind === 'interest') s.interest += v;
    else if (c.kind === 'fee') s.charges += v;
    else if (c.kind === 'deposit') s.deposits += v;
    else s.withdrawals += v;
  }
  return s;
}

export type CashBalance = { platform: string; currency: string; amount: number };

/**
 * Cash left on each platform that has deposits or withdrawals logged, per currency.
 * Platforms without any are not tracked: their trades are assumed funded from outside.
 */
export function cashBalances(flows: TradeFlow[], cash: CashEntryLike[]): CashBalance[] {
  const tracked = new Set(
    cash.filter((c) => c.kind === 'deposit' || c.kind === 'withdrawal').map((c) => platformName(c.platform))
  );
  const bal = new Map<string, CashBalance>();
  const add = (platform: string, currency: string | undefined, amount: number) => {
    if (!tracked.has(platform) || !currency || !amount) return;
    const k = `${platform}|${currency}`;
    const b = bal.get(k) ?? { platform, currency, amount: 0 };
    b.amount += amount;
    bal.set(k, b);
  };
  for (const f of flows) add(f.platform, f.settleCurrency, f.settleAmount);
  for (const c of cash) add(platformName(c.platform), c.currency.toUpperCase(), cashSign(c.kind) * c.amount);
  return Array.from(bal.values())
    .filter((b) => Math.abs(b.amount) > 1e-6)
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.currency.localeCompare(b.currency));
}

/**
 * Dated flows for XIRR in the base currency: buys and losses out, sells, income and today's value in.
 * Undefined if any amount lacks an exchange rate.
 */
export function xirrFlows(args: {
  flows: TradeFlow[];
  cash: CashEntryLike[];
  baseCurrency: string;
  fx: FxLookup;
  currentValue: number;
  asOf: string;
}): CashFlow[] | undefined {
  const out: CashFlow[] = [];
  for (const f of args.flows) {
    if (f.cashBase === undefined) return undefined;
    if (f.cashBase) out.push({ date: f.date, amount: f.cashBase });
  }
  for (const c of args.cash) {
    if (c.kind === 'deposit' || c.kind === 'withdrawal') continue;
    const date = dateOf(c.occurredAt);
    const rate = args.fx(c.currency, args.baseCurrency, date);
    if (rate === undefined) return undefined;
    out.push({ date, amount: cashSign(c.kind) * c.amount * rate });
  }
  out.push({ date: args.asOf, amount: args.currentValue });
  return out;
}
