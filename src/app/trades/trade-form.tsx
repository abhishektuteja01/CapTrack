// src/app/trades/trade-form.tsx
'use client';

import React from 'react';
import { createTradeAction } from './actions';

type Props = {
  portfolioId: string;
};

type ActionState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }
  | undefined;

export default function TradeForm({ portfolioId }: Props) {
  const [state, formAction] = React.useActionState<ActionState, FormData>(createTradeAction, undefined);

  const fieldErr = (name: string) => state && 'fieldErrors' in state ? state.fieldErrors?.[name] : undefined;

  return (
    <form action={formAction} style={{ display: 'grid', gap: 12 }}>
      <input type="hidden" name="portfolioId" value={portfolioId} />

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Occurred At</label>
        <input name="occurredAt" type="datetime-local" required />
        {fieldErr('occurredAt')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Symbol</label>
        <input name="symbol" placeholder="AAPL / BTC" required />
        {fieldErr('asset')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Asset Type</label>
        <select name="assetType" defaultValue="stock" required>
          <option value="stock">stock</option>
          <option value="etf">etf</option>
          <option value="mutual_fund">mutual_fund</option>
          <option value="crypto">crypto</option>
          <option value="cash">cash</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Side</label>
        <select name="side" defaultValue="BUY" required>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Quantity</label>
        <input name="quantity" type="number" step="any" min="0" required />
        {fieldErr('quantity')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Price (per unit)</label>
        <input name="price" type="number" step="any" min="0" required />
        {fieldErr('price')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Fees</label>
        <input name="fees" type="number" step="any" min="0" defaultValue={0} />
        {fieldErr('fees')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Currency</label>
        <input name="currency" defaultValue="USD" maxLength={3} />
        {fieldErr('currency')?.map((e) => <small key={e} style={{ color: 'crimson' }}>{e}</small>)}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label>Notes</label>
        <textarea name="notes" rows={3} />
      </div>

      <button type="submit" style={{ padding: 10, fontWeight: 600 }}>
        Add Trade
      </button>

      {state?.message ? (
        <p style={{ marginTop: 8, color: state.ok ? 'green' : 'crimson' }}>{state.message}</p>
      ) : null}
    </form>
  );
}