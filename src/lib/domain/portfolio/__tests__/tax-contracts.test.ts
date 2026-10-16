import { describe, it, expect } from 'vitest'
import { contractFromSymbol, intrinsicValue, monthlyExpiry, parseNseSymbol } from '../contracts'
import { saleRows, taxYearLabel, taxYearOf, taxYearRange, termOf, yearSummaries } from '../tax'
import { missingDividends, unadjustDividends } from '../dividends'
import { replay, type TradeLike } from '../positions'

describe('NSE symbols', () => {
  it('reads monthly futures', () => {
    expect(parseNseSymbol('NIFTY26OCTFUT')).toMatchObject({ underlying: 'NIFTY', kind: 'future', year: 2026, month: 10 })
  })
  it('reads monthly options', () => {
    expect(parseNseSymbol('BANKNIFTY26OCT47000CE')).toMatchObject({ underlying: 'BANKNIFTY', strike: 47000, optionType: 'CE' })
  })
  it('reads weekly options with the exact expiry', () => {
    expect(parseNseSymbol('NIFTY26O1920550PE')).toMatchObject({ expiry: '2026-10-19', strike: 20550, optionType: 'PE' })
  })
  it('reads stock underlyings with symbols in them', () => {
    expect(parseNseSymbol('M&M26NOVFUT')?.underlying).toBe('M&M')
  })
  it('ignores ordinary symbols', () => {
    expect(parseNseSymbol('RELIANCE.NS')).toBeUndefined()
    expect(parseNseSymbol('AAPL')).toBeUndefined()
  })
  it('monthly expiry is the last Tuesday from Sep 2025, Thursday before', () => {
    expect(monthlyExpiry(2026, 10)).toBe('2026-10-27')
    expect(monthlyExpiry(2025, 3)).toBe('2025-03-27')
  })
  it('builds a contract from a symbol', () => {
    expect(contractFromSymbol('NIFTY26OCT24500CE', 65)).toEqual({ underlying: 'NIFTY', expiry: '2026-10-27', strike: 24500, optionType: 'CE', lotSize: 65 })
  })
  it('intrinsic value', () => {
    const c = { underlying: 'NIFTY', expiry: '2026-10-27', strike: 24500 }
    expect(intrinsicValue({ ...c, optionType: 'CE' }, 24600, 'option')).toBe(100)
    expect(intrinsicValue({ ...c, optionType: 'PE' }, 24600, 'option')).toBe(0)
    expect(intrinsicValue(c, 24600, 'future')).toBe(24600)
  })
})

describe('tax years', () => {
  it('calendar and April years', () => {
    expect(taxYearOf('2025-03-31', 4)).toBe(2024)
    expect(taxYearOf('2025-04-01', 4)).toBe(2025)
    expect(taxYearOf('2025-03-31', 1)).toBe(2025)
    expect(taxYearLabel(2025, 4)).toBe('FY 2025–26')
    expect(taxYearRange(2025, 4)).toEqual({ from: '2025-04-01', to: '2026-03-31' })
    expect(taxYearRange(2025, 1)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })
  it('long-term only after the anniversary', () => {
    expect(termOf('2024-01-10T00:00:00Z', '2025-01-10T00:00:00Z', 12)).toBe('short')
    expect(termOf('2024-01-10T00:00:00Z', '2025-01-11T00:00:00Z', 12)).toBe('long')
  })
})

const t = (date: string, side: 'BUY' | 'SELL', quantity: number, price: number): TradeLike => ({
  id: `${date}${side}`,
  occurredAt: `${date}T10:00:00Z`,
  asset: { symbol: 'TCS.NS', type: 'stock' },
  side,
  quantity,
  price,
  currency: 'INR',
})

describe('sale rows', () => {
  it('splits one sale into short and long parts', () => {
    const { realizations } = replay([t('2023-01-01', 'BUY', 10, 100), t('2024-06-01', 'BUY', 10, 200), t('2024-09-01', 'SELL', 15, 300)], {
      baseCurrency: 'INR',
    })
    const rows = saleRows(realizations, 12)
    expect(rows).toHaveLength(2)
    const long = rows.find((r) => r.term === 'long')!
    const short = rows.find((r) => r.term === 'short')!
    expect(long.pnl).toBeCloseTo(2000)
    expect(short.pnl).toBeCloseTo(500)
    const [y] = yearSummaries({ sales: rows, cash: [], startMonth: 4 })
    expect(y).toMatchObject({ label: 'FY 2024–25', longTerm: 2000, shortTerm: 500 })
  })
})

describe('dividends', () => {
  it('undoes split adjustment', () => {
    expect(unadjustDividends([{ date: '2024-01-01', amount: 1 }], [{ date: '2024-06-01', ratio: 2 }])[0].amount).toBe(2)
  })
  it('suggests unlogged dividends for units held before the ex-date', () => {
    const s = missingDividends({
      trades: [t('2024-01-01', 'BUY', 10, 100)],
      cash: [],
      events: new Map([['stock::TCS.NS', { currency: 'INR', events: [{ date: '2024-03-01', amount: 5 }] }]]),
      asOf: '2024-12-31',
    })
    expect(s).toEqual([
      expect.objectContaining({ symbol: 'TCS.NS', platform: 'Manual', quantity: 10, amount: 50, exDate: '2024-03-01' }),
    ])
  })
  it('skips dividends already logged', () => {
    const s = missingDividends({
      trades: [t('2024-01-01', 'BUY', 10, 100)],
      cash: [{ occurredAt: '2024-03-20T00:00:00Z', kind: 'dividend', amount: 50, currency: 'INR', assetSymbol: 'TCS.NS' }],
      events: new Map([['stock::TCS.NS', { currency: 'INR', events: [{ date: '2024-03-01', amount: 5 }] }]]),
      asOf: '2024-12-31',
    })
    expect(s).toEqual([])
  })
})
