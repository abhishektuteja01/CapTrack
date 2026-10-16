// src/lib/services/prices/nse.ts
// NSE F&O end-of-day prices from the daily bhavcopy on nsearchives.nseindia.com (free, no cookies).
// One zipped CSV per trading day (~1.2 MB) lists every futures and options contract with its
// close, settlement price, lot size and the underlying's close. There are no free live F&O prices.

import { inflateRawSync } from 'node:zlib';
import { parseCsv } from '@/lib/domain/import/csv';

export type FoRow = {
  symbol: string; // NIFTY26OCT24500CE
  underlying: string;
  kind: 'future' | 'option';
  expiry: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  close: number;
  settle: number;
  underlyingPrice?: number;
  lotSize?: number;
};

export type Bhavcopy = { date: string; rows: Map<string, FoRow> };

const DAY_MS = 86400000;

/** The single file inside a zip archive (stored or deflated). */
export function unzipFirst(buf: Buffer): Buffer {
  // End of central directory record, searched from the end (comment may follow it).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('bad zip directory');
  const method = buf.readUInt16LE(cd + 10);
  const size = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  const nameLen = buf.readUInt16LE(local + 26);
  const extraLen = buf.readUInt16LE(local + 28);
  const start = local + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + size);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return inflateRawSync(data);
  throw new Error(`unsupported zip method ${method}`);
}

/** Parse the bhavcopy CSV (UDiFF format, in use since July 2024). */
export function parseFoBhavcopy(csv: string): Map<string, FoRow> {
  const [header = [], ...rows] = parseCsv(csv);
  const col = (name: string) => header.indexOf(name);
  const c = {
    date: col('TradDt'),
    type: col('FinInstrmTp'),
    name: col('FinInstrmNm'),
    und: col('TckrSymb'),
    expiry: col('XpryDt'),
    strike: col('StrkPric'),
    opt: col('OptnTp'),
    close: col('ClsPric'),
    settle: col('SttlmPric'),
    undPrice: col('UndrlygPric'),
    lot: col('NewBrdLotQty'),
  };
  if (c.name < 0 || c.close < 0) throw new Error('unexpected bhavcopy columns');
  const out = new Map<string, FoRow>();
  for (const r of rows) {
    const type = r[c.type];
    const kind = type === 'IDF' || type === 'STF' ? 'future' : type === 'IDO' || type === 'STO' ? 'option' : undefined;
    if (!kind) continue;
    const symbol = r[c.name]?.trim().toUpperCase();
    if (!symbol) continue;
    const num = (i: number) => {
      const n = i >= 0 ? Number(r[i]) : NaN;
      return Number.isFinite(n) ? n : undefined;
    };
    const opt = r[c.opt];
    const strike = kind === 'option' ? num(c.strike) : undefined;
    let settle = num(c.settle) ?? num(c.close) ?? 0;
    // On expiry day NSE puts the underlying's final settlement price in SttlmPric for options;
    // what the option itself settles at is its intrinsic value against that.
    if (kind === 'option' && strike !== undefined && r[c.expiry] && r[c.expiry] === r[c.date]) {
      settle = opt === 'PE' ? Math.max(0, strike - settle) : Math.max(0, settle - strike);
    }
    out.set(symbol, {
      symbol,
      underlying: r[c.und],
      kind,
      expiry: r[c.expiry],
      strike,
      optionType: opt === 'CE' || opt === 'PE' ? opt : undefined,
      close: num(c.close) ?? 0,
      settle,
      underlyingPrice: num(c.undPrice),
      lotSize: num(c.lot),
    });
  }
  return out;
}

const memo = new Map<string, Promise<Bhavcopy | null>>();

/** One trading day's F&O bhavcopy, or null when there's no file (holiday, weekend, not out yet). */
export function fetchFoBhavcopy(date: string): Promise<Bhavcopy | null> {
  let p = memo.get(date);
  if (!p) {
    p = (async () => {
      const ymd = date.replace(/-/g, '');
      const url = `https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${ymd}_F_0000.csv.zip`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CapTrack/1.0)', Accept: '*/*' },
        cache: 'no-store',
      });
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) throw new Error(`NSE bhavcopy ${res.status} for ${date}`);
      const csv = unzipFirst(Buffer.from(await res.arrayBuffer())).toString('utf8');
      return { date, rows: parseFoBhavcopy(csv) };
    })().catch((e) => {
      memo.delete(date);
      throw e;
    });
    memo.set(date, p);
    // Keep the newest few days only.
    if (memo.size > 8) memo.delete(memo.keys().next().value!);
  }
  return p;
}

/** The newest bhavcopy on or before `date`, looking back up to a week. */
export async function latestFoBhavcopy(date: string): Promise<Bhavcopy | null> {
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.parse(`${date}T00:00:00Z`) - i * DAY_MS);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const b = await fetchFoBhavcopy(d.toISOString().slice(0, 10)).catch(() => null);
    if (b) return b;
  }
  return null;
}

/** Weekdays from `from` to `to` inclusive (trading days are a subset). */
export function weekdays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
