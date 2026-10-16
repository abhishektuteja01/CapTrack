// src/lib/example-portfolio.ts
// A fixed, made-up portfolio for the landing page and screenshots.
// Built with the same domain functions as real data, so the numbers add up.

import { assetKey } from '@/lib/domain/portfolio/positions';
import type { PriceSeries } from '@/lib/domain/portfolio/history';
import type { UsdRateRow } from '@/lib/domain/fx/rates';
import type { Quote } from '@/lib/services/prices/quotes';
import { assemble, type AppCash, type AppTrade, type PortfolioSnapshot } from '@/lib/portfolio';

const AS_OF = '2026-10-15';
const BASE = 'INR';

type Asset = {
  symbol: string;
  name: string;
  platform: string;
  currency: string;
  start: number; // price on 2023-01-02
  end: number; // price on AS_OF
  prev: number; // previous close
  wobble: number;
};

const ASSETS: Asset[] = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', platform: 'Zerodha', currency: 'INR', start: 2540, end: 2862.3, prev: 2840.1, wobble: 0.08 },
  { symbol: 'AAPL', name: 'Apple', platform: 'Interactive Brokers', currency: 'USD', start: 125, end: 231.85, prev: 233.1, wobble: 0.1 },
  { symbol: 'NIFTYBEES.NS', name: 'Nippon India Nifty 50 BeES', platform: 'Groww', currency: 'INR', start: 196, end: 287.15, prev: 286.2, wobble: 0.05 },
  { symbol: 'ASML.AS', name: 'ASML Holding', platform: 'Interactive Brokers', currency: 'EUR', start: 590, end: 718.4, prev: 709.8, wobble: 0.14 },
  { symbol: 'INFY.NS', name: 'Infosys', platform: 'Zerodha', currency: 'INR', start: 1510, end: 1534.6, prev: 1549, wobble: 0.1 },
  { symbol: 'MSFT', name: 'Microsoft', platform: 'Vested', currency: 'USD', start: 240, end: 448.2, prev: 446, wobble: 0.07 },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', platform: 'Groww', currency: 'INR', start: 1620, end: 1621.4, prev: 1618, wobble: 0.06 },
  { symbol: 'VOD.L', name: 'Vodafone Group', platform: 'Interactive Brokers', currency: 'GBP', start: 0.9, end: 0.74, prev: 0.75, wobble: 0.08 },
];

// [symbol, date, side, qty, price]
const TRADES: [string, string, 'BUY' | 'SELL', number, number][] = [
  ['NIFTYBEES.NS', '2023-01-09', 'BUY', 500, 198.2],
  ['RELIANCE.NS', '2023-02-14', 'BUY', 80, 2398],
  ['AAPL', '2023-03-20', 'BUY', 25, 157.4],
  ['INFY.NS', '2023-05-08', 'BUY', 150, 1712],
  ['MSFT', '2023-07-17', 'BUY', 12, 345.2],
  ['NIFTYBEES.NS', '2023-10-03', 'BUY', 400, 212.6],
  ['VOD.L', '2023-11-21', 'BUY', 2000, 0.71],
  ['ASML.AS', '2024-02-12', 'BUY', 6, 612],
  ['RELIANCE.NS', '2024-04-22', 'BUY', 40, 2445],
  ['AAPL', '2024-06-10', 'BUY', 15, 190.5],
  ['VOD.L', '2024-09-30', 'SELL', 2000, 0.76],
  ['HDFCBANK.NS', '2025-01-20', 'BUY', 80, 1655],
  ['MSFT', '2025-04-14', 'SELL', 4, 392.5],
  ['NIFTYBEES.NS', '2025-08-04', 'BUY', 200, 271.9],
];

const FX_START: Record<string, number> = { INR: 1 / 82.7, EUR: 1.067, GBP: 1.205 };
const FX_END: Record<string, number> = { INR: 1 / 88.4, EUR: 1.161, GBP: 1.334 };

const DAY = 86400000;
const t0 = Date.parse('2023-01-02T00:00:00Z');
const t1 = Date.parse(`${AS_OF}T00:00:00Z`);

/** Smooth, repeatable path from start to end with some movement in between. */
function path(start: number, end: number, wobble: number, seed: number, t: number) {
  const f = (t - t0) / (t1 - t0);
  const env = Math.sin(Math.PI * f);
  const noise = env * wobble * (Math.sin(f * 23 + seed) * 0.6 + Math.sin(f * 61 + seed * 2) * 0.4);
  return start * Math.pow(end / start, f) * (1 + noise);
}

function weekdays(): string[] {
  const out: string[] = [];
  for (let t = t0; t <= t1; t += DAY) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

let cached: PortfolioSnapshot | null = null;

const typeOf = (symbol: string) => (symbol.endsWith('BEES.NS') ? 'etf' : 'stock');

export function examplePortfolio(): PortfolioSnapshot {
  if (cached) return cached;
  const days = weekdays();
  const bySymbol = new Map(ASSETS.map((a) => [a.symbol, a]));

  const fxRows: UsdRateRow[] = [];
  for (const [ccy, start] of Object.entries(FX_START)) {
    for (const d of days) {
      fxRows.push({ date: d, currency: ccy, usdPerUnit: path(start, FX_END[ccy], 0.015, ccy.length, Date.parse(d)) });
    }
  }

  const trades: AppTrade[] = TRADES.map(([symbol, date, side, quantity, price], i) => {
    const a = bySymbol.get(symbol)!;
    return {
      id: String(i),
      occurredAt: `${date}T09:30:00Z`,
      asset: { symbol, type: typeOf(symbol) },
      name: a.name,
      side,
      quantity,
      price,
      fees: Math.round(quantity * price * 0.0005 * 100) / 100,
      currency: a.currency,
      platform: a.platform,
    };
  });

  const cash: AppCash[] = [
    { id: 'c1', occurredAt: '2024-08-20T09:30:00Z', kind: 'dividend', amount: 800, currency: 'INR', platform: 'Zerodha', assetSymbol: 'RELIANCE.NS', assetType: 'stock' },
    { id: 'c2', occurredAt: '2025-06-12T09:30:00Z', kind: 'dividend', amount: 6300, currency: 'INR', platform: 'Zerodha', assetSymbol: 'INFY.NS', assetType: 'stock' },
  ];

  const prices = new Map<string, PriceSeries>();
  const quotes = new Map<string, Quote>();
  ASSETS.forEach((a, i) => {
    const key = assetKey(a.symbol, typeOf(a.symbol));
    prices.set(key, {
      currency: a.currency,
      points: days.map((d) => ({
        date: d,
        close: d === AS_OF ? a.end : path(a.start, a.end, a.wobble, i + 1, Date.parse(d)),
      })),
    });
    quotes.set(key, {
      name: a.name,
      price: a.end,
      currency: a.currency,
      previousClose: a.prev,
      dayChangePercent: ((a.end - a.prev) / a.prev) * 100,
      timestamp: Date.parse(`${AS_OF}T10:00:00Z`),
      intraday: Array.from({ length: 48 }, (_, k) => a.prev + (a.end - a.prev) * (k / 47) + Math.sin(k / 3 + a.symbol.length) * a.end * 0.002),
      source: 'yahoo',
    });
  });
  const benchmark: PriceSeries = {
    currency: 'INR',
    points: days.map((d) => ({ date: d, close: path(17900, 25100, 0.06, 9, Date.parse(d)) })),
  };

  const { snapshot } = assemble({
    baseCurrency: BASE,
    platforms: ['Zerodha', 'Interactive Brokers', 'Groww', 'Vested'],
    settings: { costMethod: 'fifo', fyStartMonth: 4, longTermMonths: 12, benchmark: '^NSEI' },
    trades,
    cash,
    prices,
    splits: new Map(),
    dividends: new Map(),
    fxRows,
    benchmark,
    underlyings: new Map(),
    quotes,
    sources: ['Yahoo Finance'],
    today: AS_OF,
  });
  // Fixed clock: never "stale".
  cached = { ...snapshot, pricesStale: false };
  return cached;
}
