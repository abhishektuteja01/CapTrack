// src/lib/domain/import/formats.ts
// Turn broker CSVs into trade and cash drafts. Runs in the browser for the preview; the server
// validates every draft again before saving.
//
// Formats:
// - captrack: our own export (round-trips trades and cash entries)
// - zerodha: Console tradebook (equity and F&O)
// - generic: any CSV with recognisable column names (date, symbol, side, quantity, price, …)

import { parseCsv, toCsv } from './csv';
import { contractFromSymbol } from '../portfolio/contracts';
import { CASH_KINDS, type CashKind } from '../portfolio/money';

export type TradeDraft = {
  kind: 'trade';
  occurredAt: string;
  symbol: string;
  assetType: string;
  assetName?: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  platform: string;
  notes?: string;
  fxRate?: number;
  fxQuote?: string;
  externalId?: string;
  underlying?: string;
  expiry?: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  lotSize?: number;
};

export type CashDraft = {
  kind: 'cash';
  occurredAt: string;
  cashKind: CashKind;
  amount: number;
  currency: string;
  platform: string;
  assetSymbol?: string;
  assetType?: string;
  notes?: string;
  externalId?: string;
};

export type Draft = TradeDraft | CashDraft;
export type ImportRow = { line: number; draft?: Draft; error?: string };
export type ImportFormat = 'captrack' | 'zerodha' | 'generic';

export type ImportOptions = {
  format?: ImportFormat;
  platform: string;
  currency: string;
  /** How to read 03/04/2025 in generic files. */
  dateOrder?: 'dmy' | 'mdy';
};

export const FORMAT_LABELS: Record<ImportFormat, string> = {
  captrack: 'CapTrack export',
  zerodha: 'Zerodha tradebook',
  generic: 'Other CSV',
};

const ASSET_TYPES = ['stock', 'etf', 'mutual_fund', 'crypto', 'future', 'option', 'other'];

export const CAPTRACK_HEADER = [
  'date',
  'kind',
  'symbol',
  'type',
  'name',
  'quantity',
  'price',
  'fees',
  'amount',
  'currency',
  'platform',
  'fx_rate',
  'fx_quote',
  'underlying',
  'expiry',
  'strike',
  'option_type',
  'lot_size',
  'notes',
  'id',
];

const norm = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function detectFormat(header: string[]): ImportFormat {
  const h = header.map(norm);
  if (['date', 'kind', 'symbol', 'type', 'amount', 'platform'].every((c) => h.includes(c))) return 'captrack';
  if (['trade_date', 'trade_type', 'trade_id', 'segment'].every((c) => h.includes(c))) return 'zerodha';
  return 'generic';
}

/** "1,234.50", "₹1,234.50", "(12)" → number. Empty → undefined. */
export function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  let s = raw.trim();
  if (!s) return undefined;
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[()\s,]/g, '').replace(/[^0-9.eE+-]/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return negative ? -n : n;
}

/** Local date and time → ISO. Accepts ISO, YYYY-MM-DD[ HH:MM[:SS]], DD-MM-YYYY, DD/MM/YYYY or MM/DD/YYYY. */
export function parseDate(raw: string | undefined, order: 'dmy' | 'mdy' = 'dmy', offset?: string): string | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  if (/\d{2}:\d{2}(:\d{2})?(\.\d+)?([zZ]|[+-]\d{2}:?\d{2})$/.test(s) && !Number.isNaN(Date.parse(s))) return new Date(s).toISOString();
  let y: number, mo: number, d: number;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  let time: string[] = [];
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    time = [m[4], m[5], m[6]];
  } else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (!m) {
      const t = Date.parse(s);
      return Number.isNaN(t) ? undefined : new Date(t).toISOString();
    }
    const a = Number(m[1]);
    const b = Number(m[2]);
    y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    [d, mo] = order === 'mdy' && b <= 12 ? [b, a] : a > 12 || order === 'dmy' ? [a, b] : [b, a];
    time = [m[4], m[5], m[6]];
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const [hh, mm, ss] = time.map((x) => Number(x ?? 0));
  // A date alone means midday, so time zones can't move it to another day.
  const hour = time[0] === undefined ? 12 : hh;
  if (offset) {
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}${offset}`;
    return new Date(iso).toISOString();
  }
  return new Date(y, mo - 1, d, hour, mm, ss).toISOString();
}

function sideOf(raw: string | undefined): 'BUY' | 'SELL' | undefined {
  const s = raw?.trim().toLowerCase();
  if (!s) return undefined;
  if (['buy', 'b', 'bought', 'purchase', 'bot'].includes(s) || s.startsWith('buy')) return 'BUY';
  if (['sell', 's', 'sold', 'sld', 'redemption', 'redeem'].includes(s) || s.startsWith('sell')) return 'SELL';
  return undefined;
}

function typeOf(raw: string | undefined, symbol: string): string {
  const s = norm(raw ?? '');
  if (ASSET_TYPES.includes(s)) return s;
  if (s === 'equity' || s === 'eq' || s === 'share' || s === 'shares') return 'stock';
  if (s.includes('fund') || s === 'mf') return 'mutual_fund';
  if (s.includes('crypto')) return 'crypto';
  if (s.includes('fut')) return 'future';
  if (s.includes('opt')) return 'option';
  if (/^\d{5,6}$/.test(symbol)) return 'mutual_fund';
  if (/-USD$/.test(symbol)) return 'crypto';
  return contractFromSymbol(symbol) ? (symbol.endsWith('FUT') ? 'future' : 'option') : 'stock';
}

/** Fill contract fields for F&O symbols when the file doesn't carry them. */
function withContract(d: TradeDraft): TradeDraft {
  if (d.assetType !== 'future' && d.assetType !== 'option') return d;
  const c = contractFromSymbol(d.symbol);
  return {
    ...d,
    underlying: d.underlying ?? c?.underlying,
    expiry: d.expiry ?? c?.expiry,
    strike: d.strike ?? c?.strike,
    optionType: d.optionType ?? c?.optionType,
  };
}

function checkTrade(d: TradeDraft): string | undefined {
  if (!d.occurredAt) return 'No date';
  if (!d.symbol) return 'No symbol';
  if (!(d.quantity > 0)) return 'Quantity must be more than 0';
  if (!(d.price >= 0)) return 'No price';
  if (!/^[A-Z]{3}$/.test(d.currency)) return 'No currency';
  if ((d.assetType === 'future' || d.assetType === 'option') && !d.expiry) return 'No expiry for this contract';
  return undefined;
}

type Getter = (...names: string[]) => string | undefined;

function getter(header: string[], row: string[]): Getter {
  const idx = new Map(header.map((h, i) => [norm(h), i]));
  return (...names) => {
    for (const n of names) {
      const i = idx.get(n);
      if (i !== undefined && row[i] !== undefined && row[i].trim() !== '') return row[i].trim();
    }
    return undefined;
  };
}

function fromCaptrack(get: Getter, o: ImportOptions): Draft | string {
  const occurredAt = parseDate(get('date'), 'dmy');
  const kind = get('kind')?.toLowerCase();
  if (!occurredAt) return 'No date';
  const platform = get('platform') ?? o.platform;
  const currency = (get('currency') ?? o.currency).toUpperCase();
  if (kind && (CASH_KINDS as string[]).includes(kind)) {
    const amount = parseNumber(get('amount'));
    if (!amount || amount <= 0) return 'Amount must be more than 0';
    return {
      kind: 'cash',
      occurredAt,
      cashKind: kind as CashKind,
      amount,
      currency,
      platform,
      assetSymbol: get('symbol')?.toUpperCase(),
      assetType: get('type'),
      notes: get('notes'),
      externalId: get('id'),
    };
  }
  const side = sideOf(kind);
  if (!side) return `Unknown kind "${get('kind') ?? ''}"`;
  const symbol = (get('symbol') ?? '').toUpperCase();
  const d = withContract({
    kind: 'trade',
    occurredAt,
    symbol,
    assetType: typeOf(get('type'), symbol),
    assetName: get('name'),
    side,
    quantity: parseNumber(get('quantity')) ?? 0,
    price: parseNumber(get('price')) ?? -1,
    fees: parseNumber(get('fees')) ?? 0,
    currency,
    platform,
    notes: get('notes'),
    fxRate: parseNumber(get('fx_rate')),
    fxQuote: get('fx_quote')?.toUpperCase(),
    underlying: get('underlying')?.toUpperCase(),
    expiry: get('expiry')?.slice(0, 10),
    strike: parseNumber(get('strike')),
    optionType: get('option_type')?.toUpperCase() as 'CE' | 'PE' | undefined,
    lotSize: parseNumber(get('lot_size')),
    externalId: get('id'),
  });
  return checkTrade(d) ?? d;
}

function fromZerodha(get: Getter, o: ImportOptions): Draft | string {
  const segment = (get('segment') ?? '').toUpperCase();
  const exchange = (get('exchange') ?? 'NSE').toUpperCase();
  const raw = (get('symbol') ?? '').toUpperCase();
  const side = sideOf(get('trade_type'));
  if (!side) return `Unknown trade type "${get('trade_type') ?? ''}"`;
  const fno = segment === 'FO' || exchange === 'NFO' || exchange === 'BFO';
  const occurredAt = parseDate(get('order_execution_time') ?? get('trade_date'), 'dmy', '+05:30');
  const symbol = fno ? raw : exchange === 'BSE' ? `${raw}.BO` : `${raw}.NS`;
  const d = withContract({
    kind: 'trade',
    occurredAt: occurredAt ?? '',
    symbol,
    assetType: fno ? (raw.endsWith('FUT') ? 'future' : 'option') : 'stock',
    side,
    quantity: parseNumber(get('quantity')) ?? 0,
    price: parseNumber(get('price')) ?? -1,
    fees: 0,
    currency: 'INR',
    platform: o.platform,
    expiry: get('expiry_date')?.slice(0, 10),
    externalId: get('trade_id') ? `zerodha:${exchange}:${get('trade_id')}` : undefined,
  });
  return checkTrade(d) ?? d;
}

function fromGeneric(get: Getter, o: ImportOptions): Draft | string {
  const occurredAt = parseDate(
    get('date', 'trade_date', 'datetime', 'date_time', 'time', 'timestamp', 'executed_at', 'order_date', 'transaction_date'),
    o.dateOrder ?? 'dmy'
  );
  const symbol = (get('symbol', 'ticker', 'instrument', 'scrip', 'stock', 'security', 'asset', 'scheme_code') ?? '').toUpperCase();
  const side = sideOf(get('side', 'action', 'trade_type', 'transaction_type', 'type', 'buy_sell', 'b_s', 'transaction'));
  if (!side) return 'No buy or sell column';
  const quantity = parseNumber(get('quantity', 'qty', 'shares', 'units', 'volume'));
  let price = parseNumber(get('price', 'trade_price', 'avg_price', 'average_price', 'rate', 'nav', 'unit_price', 'price_per_unit'));
  const amount = parseNumber(get('amount', 'value', 'total', 'net_amount', 'trade_value'));
  if (price === undefined && amount !== undefined && quantity) price = Math.abs(amount) / quantity;
  const d = withContract({
    kind: 'trade',
    occurredAt: occurredAt ?? '',
    symbol,
    assetType: typeOf(get('asset_type', 'asset_class', 'instrument_type', 'category', 'segment'), symbol),
    assetName: get('name', 'description', 'security_name', 'company'),
    side,
    quantity: Math.abs(quantity ?? 0),
    price: price ?? -1,
    fees: Math.abs(parseNumber(get('fees', 'fee', 'commission', 'brokerage', 'charges', 'taxes')) ?? 0),
    currency: (get('currency', 'ccy') ?? o.currency).toUpperCase(),
    platform: get('platform', 'broker', 'account') ?? o.platform,
    notes: get('notes', 'note', 'remarks', 'comment'),
    externalId: get('trade_id', 'order_id', 'transaction_id', 'id', 'reference'),
  });
  return checkTrade(d) ?? d;
}

/** Parse a whole file. Every data row comes back, with either a draft or the reason it can't be used. */
export function parseImport(text: string, o: ImportOptions): { format: ImportFormat; header: string[]; rows: ImportRow[] } {
  const [header = [], ...data] = parseCsv(text);
  const format = o.format ?? detectFormat(header);
  const read = format === 'captrack' ? fromCaptrack : format === 'zerodha' ? fromZerodha : fromGeneric;
  const rows = data.map((r, i): ImportRow => {
    const res = read(getter(header, r), o);
    return typeof res === 'string' ? { line: i + 2, error: res } : { line: i + 2, draft: res };
  });
  return { format, header, rows };
}

/** Our own CSV: trades and cash entries, oldest first, re-importable. */
export function exportCsv(drafts: (Draft & { id?: string })[]): string {
  const rows = drafts.map((d) =>
    d.kind === 'trade'
      ? [
          d.occurredAt,
          d.side,
          d.symbol,
          d.assetType,
          d.assetName,
          d.quantity,
          d.price,
          d.fees,
          d.quantity * d.price + (d.side === 'BUY' ? d.fees : -d.fees),
          d.currency,
          d.platform,
          d.fxRate,
          d.fxQuote,
          d.underlying,
          d.expiry,
          d.strike,
          d.optionType,
          d.lotSize,
          d.notes,
          d.externalId ?? d.id,
        ]
      : [
          d.occurredAt,
          d.cashKind,
          d.assetSymbol,
          d.assetType,
          '',
          '',
          '',
          '',
          d.amount,
          d.currency,
          d.platform,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          d.notes,
          d.externalId ?? d.id,
        ]
  );
  return toCsv(CAPTRACK_HEADER, rows);
}
