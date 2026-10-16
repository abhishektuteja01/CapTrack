'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { importAction, type ImportResult } from '@/app/(app)/trades/actions';
import { FORMAT_LABELS, parseImport, type ImportFormat, type ImportOptions } from '@/lib/domain/import/formats';
import { money, price, qty } from '@/lib/format';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Table, Td, Th } from '@/components/ui/table';
import { inputClass } from './symbol-autocomplete';
import { CASH_KIND_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';

const PREVIEW = 200;

/**
 * CSV import: pick a file, check the preview, import. Parsing happens here in the browser;
 * the server validates every row again and skips ones already saved.
 */
export function ImportView({ platforms, baseCurrency }: { platforms: string[]; baseCurrency: string }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [format, setFormat] = useState<ImportFormat | ''>('');
  const [platform, setPlatform] = useState(platforms[0] ?? 'Manual');
  const [currency, setCurrency] = useState(baseCurrency);
  const [dateOrder, setDateOrder] = useState<'dmy' | 'mdy'>('dmy');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  // Remounts the file input after an import, so picking the same file again still loads it.
  const [inputKey, setInputKey] = useState(0);

  const parsed = useMemo(() => {
    if (!file) return null;
    const o: ImportOptions = { format: format || undefined, platform: platform.trim() || 'Manual', currency, dateOrder };
    return parseImport(file.text, o);
  }, [file, format, platform, currency, dateOrder]);

  const good = parsed?.rows.filter((r) => r.draft) ?? [];
  const bad = parsed?.rows.filter((r) => r.error) ?? [];
  const detected = parsed?.format;

  async function onFile(f: File | undefined) {
    setResult(null);
    if (!f) return setFile(null);
    setFile({ name: f.name, text: await f.text() });
    setFormat('');
  }

  function submit() {
    if (!good.length) return;
    start(async () => {
      const res = await importAction(JSON.stringify(good.map((r) => ({ line: r.line, draft: r.draft }))));
      setResult(res);
      if (res.ok) {
        setFile(null);
        setInputKey((k) => k + 1);
      }
    });
  }

  return (
    <div className="flex max-w-5xl flex-col gap-3">
      <div className="flex items-center gap-2 text-[13px]">
        <Link href="/trades" className="text-accent hover:underline">
          Activity
        </Link>
        <span className="text-ink-3">/</span>
        <h1 className="text-base font-semibold">Import</h1>
      </div>

      <Panel>
        <PanelHeader title="File" meta="CSV from your broker or a CapTrack export" />
        <div className="flex flex-col gap-3 p-4 text-[13px]">
          <input
            key={inputKey}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="text-[13px] file:mr-3 file:h-8 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:text-[13px] file:text-ink hover:file:bg-hover"
          />
          <ul className="list-disc pl-5 text-2xs text-ink-3">
            <li>Zerodha: Console → Reports → Tradebook, one file per segment (Equity, F&O). Stocks get .NS or .BO.</li>
            <li>Other brokers: any CSV with date, symbol, buy/sell, quantity and price columns. Amount works in place of price.</li>
            <li>Rows already in your log are skipped, so importing the same file twice is safe.</li>
          </ul>
          {file ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value as ImportFormat | '')} className={inputClass}>
                  <option value="">Detected: {detected ? FORMAT_LABELS[detected] : '…'}</option>
                  {(Object.keys(FORMAT_LABELS) as ImportFormat[]).map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">Platform</span>
                <input list="import-platforms" value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass} />
                <datalist id="import-platforms">
                  {platforms.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              {detected === 'generic' ? (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">Currency if missing</span>
                    <input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={cn(inputClass, 'num uppercase')} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="condensed text-2xs font-medium uppercase tracking-[0.05em] text-ink-3">Dates like 03/04/2025</span>
                    <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as 'dmy' | 'mdy')} className={inputClass}>
                      <option value="dmy">3 April (day first)</option>
                      <option value="mdy">March 4 (month first)</option>
                    </select>
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>

      {result ? (
        <Notice tone={result.ok ? 'info' : 'neg'} label={result.ok ? 'Done' : 'Stopped'}>
          {result.message}{' '}
          {result.ok ? (
            <Link href="/trades" className="text-accent hover:underline">
              See activity
            </Link>
          ) : null}
          {result.failed?.length ? (
            <span className="block text-2xs">
              {result.failed.slice(0, 5).map((f) => `Line ${f.line}: ${f.message}`).join(' · ')}
            </span>
          ) : null}
        </Notice>
      ) : null}

      {parsed ? (
        <Panel>
          <PanelHeader
            title={`Preview · ${good.length} ready`}
            meta={bad.length ? `${bad.length} can't be read` : file?.name}
            actions={
              <Button size="sm" variant="primary" disabled={!good.length || pending} onClick={submit}>
                {pending ? 'Importing…' : `Import ${good.length}`}
              </Button>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th numeric>Line</Th>
                <Th>Date</Th>
                <Th>Kind</Th>
                <Th>Symbol</Th>
                <Th numeric>Qty</Th>
                <Th numeric>Price</Th>
                <Th numeric wide>Amount</Th>
                <Th wide>Platform</Th>
              </tr>
            </thead>
            <tbody>
              {parsed.rows.slice(0, PREVIEW).map((r) => {
                const d = r.draft;
                if (!d)
                  return (
                    <tr key={r.line} className="bg-neg-soft/50">
                      <Td numeric className="text-ink-3">{r.line}</Td>
                      <Td colSpan={7} className="text-neg">
                        {r.error}
                      </Td>
                    </tr>
                  );
                return (
                  <tr key={r.line} className="hover:bg-hover">
                    <Td numeric className="text-ink-3">{r.line}</Td>
                    <Td className="num">{new Date(d.occurredAt).toLocaleDateString('en-GB')}</Td>
                    <Td className="text-2xs uppercase">{d.kind === 'trade' ? d.side : CASH_KIND_LABELS[d.cashKind]}</Td>
                    <Td className="font-semibold">
                      {d.kind === 'trade' ? d.symbol : d.assetSymbol ?? ''}
                      {d.kind === 'trade' && d.assetType !== 'stock' ? <span className="ml-1.5 text-2xs font-normal text-ink-3">{d.assetType}</span> : null}
                    </Td>
                    <Td numeric>{d.kind === 'trade' ? qty(d.quantity) : ''}</Td>
                    <Td numeric>{d.kind === 'trade' ? price(d.price, d.currency) : ''}</Td>
                    <Td numeric wide>{money(d.kind === 'trade' ? d.quantity * d.price : d.amount, d.currency)}</Td>
                    <Td wide className="text-ink-2">{d.platform}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {parsed.rows.length > PREVIEW ? (
            <p className="px-3 py-2 text-2xs text-ink-3">Showing the first {PREVIEW} of {parsed.rows.length} rows. All of them will be imported.</p>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
