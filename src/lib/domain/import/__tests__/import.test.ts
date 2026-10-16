import { describe, it, expect } from 'vitest'
import { parseCsv, toCsv } from '../csv'
import { detectFormat, exportCsv, parseDate, parseImport, parseNumber, type TradeDraft } from '../formats'

describe('csv', () => {
  it('handles quotes, commas, CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })
  it('round-trips and defuses formulas', () => {
    const s = toCsv(['n'], [['=1+1'], [-5], ['a,b']])
    expect(parseCsv(s)).toEqual([['n'], ["'=1+1"], ['-5'], ['a,b']])
  })
})

describe('values', () => {
  it('numbers', () => {
    expect(parseNumber('₹1,234.50')).toBe(1234.5)
    expect(parseNumber('(12)')).toBe(-12)
    expect(parseNumber('')).toBeUndefined()
  })
  it('dates with an offset', () => {
    expect(parseDate('2024-03-05T09:15:30', 'dmy', '+05:30')).toBe('2024-03-05T03:45:30.000Z')
    expect(parseDate('05-03-2024', 'dmy', '+05:30')).toBe('2024-03-05T06:30:00.000Z')
    expect(parseDate('03/05/2024', 'mdy', '+00:00')).toBe('2024-03-05T12:00:00.000Z')
    expect(parseDate('nope')).toBeUndefined()
  })
})

const ZERODHA = `symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time,expiry_date
INFY,INE009A01021,2024-03-05,NSE,EQ,EQ,buy,false,10.000000,1500.50,123,456,2024-03-05T09:15:30,
NIFTY26OCT24500CE,,2026-10-01,NFO,FO,,sell,false,65.000000,100.00,789,999,2026-10-01T10:00:00,2026-10-27
TCS,INE467B01029,2024-03-06,BSE,EQ,A,sell,false,1,4000,124,457,2024-03-06T10:00:00,
`

describe('zerodha tradebook', () => {
  const { format, rows } = parseImport(ZERODHA, { platform: 'Zerodha', currency: 'INR' })
  it('is detected', () => expect(format).toBe('zerodha'))
  it('maps equity rows to NSE/BSE symbols in IST', () => {
    expect(rows[0].draft).toMatchObject({ symbol: 'INFY.NS', side: 'BUY', quantity: 10, price: 1500.5, occurredAt: '2024-03-05T03:45:30.000Z', externalId: 'zerodha:NSE:123' })
    expect(rows[2].draft).toMatchObject({ symbol: 'TCS.BO', side: 'SELL' })
  })
  it('maps F&O rows with contract details', () => {
    expect(rows[1].draft).toMatchObject({ assetType: 'option', underlying: 'NIFTY', expiry: '2026-10-27', strike: 24500, optionType: 'CE' })
  })
})

describe('generic csv', () => {
  it('finds columns by common names and derives price from amount', () => {
    const { format, rows } = parseImport('Date,Ticker,Action,Shares,Amount,Commission\n2024-01-02,aapl,Buy,10,"1,500.00",1\n2024-01-03,MSFT,Dividend,,,', {
      platform: 'Robinhood',
      currency: 'USD',
    })
    expect(format).toBe('generic')
    expect(rows[0].draft).toMatchObject({ symbol: 'AAPL', side: 'BUY', quantity: 10, price: 150, fees: 1, currency: 'USD', platform: 'Robinhood' })
    expect(rows[1].error).toBeDefined()
  })
  it('detects formats', () => {
    expect(detectFormat(['date', 'kind', 'symbol', 'type', 'amount', 'platform'])).toBe('captrack')
  })
})

describe('captrack export', () => {
  it('round-trips trades and cash', () => {
    const trade: TradeDraft = {
      kind: 'trade',
      occurredAt: '2024-01-02T10:00:00.000Z',
      symbol: 'NIFTY26OCTFUT',
      assetType: 'future',
      side: 'SELL',
      quantity: 65,
      price: 24000,
      fees: 20,
      currency: 'INR',
      platform: 'Zerodha',
      underlying: 'NIFTY',
      expiry: '2026-10-27',
      lotSize: 65,
      externalId: 'x1',
    }
    const csv = exportCsv([
      trade,
      { kind: 'cash', occurredAt: '2024-01-01T00:00:00.000Z', cashKind: 'deposit', amount: 1000, currency: 'INR', platform: 'Zerodha', notes: 'salary' },
    ])
    const { format, rows } = parseImport(csv, { platform: 'Manual', currency: 'USD' })
    expect(format).toBe('captrack')
    expect(rows[0].draft).toMatchObject({ ...trade, assetName: undefined })
    expect(rows[1].draft).toMatchObject({ kind: 'cash', cashKind: 'deposit', amount: 1000, notes: 'salary' })
  })
})
