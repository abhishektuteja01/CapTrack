// src/lib/benchmarks.ts
// Indices offered as a benchmark. Any Yahoo symbol works; these get a friendly name.

export const BENCHMARKS = [
  { symbol: '^NSEI', label: 'Nifty 50' },
  { symbol: '^BSESN', label: 'Sensex' },
  { symbol: '^NSEBANK', label: 'Nifty Bank' },
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^NDX', label: 'Nasdaq 100' },
  { symbol: '^FTSE', label: 'FTSE 100' },
  { symbol: 'URTH', label: 'MSCI World (URTH)' },
];

export function benchmarkLabel(symbol: string | null | undefined) {
  if (!symbol) return undefined;
  return BENCHMARKS.find((b) => b.symbol === symbol.toUpperCase())?.label ?? symbol.toUpperCase();
}
