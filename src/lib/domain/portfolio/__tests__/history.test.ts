import { describe, it, expect } from 'vitest'
import { buildHistory } from '../history'
import { xirrFlows } from '../money'
import { replay } from '../positions'
import { xirr } from '../xirr'
import { makeFxLookup } from '../../fx/rates'
import type { TradeLike } from '../positions'

const fx = makeFxLookup([{ date: '2024-01-01', currency: 'INR', usdPerUnit: 0.0125 }]) // 80 INR/USD

const trades: TradeLike[] = [
  { occurredAt: '2024-01-02T10:00:00Z', asset: { symbol: 'AAPL', type: 'stock' }, side: 'BUY', quantity: 10, price: 100, currency: 'USD' },
  { occurredAt: '2024-01-04T10:00:00Z', asset: { symbol: 'INFY.NS', type: 'stock' }, side: 'BUY', quantity: 5, price: 1500, currency: 'INR' },
]

describe('buildHistory', () => {
  const prices = new Map([
    ['stock::AAPL', { currency: 'USD', points: [{ date: '2024-01-02', close: 101 }, { date: '2024-01-05', close: 110 }] }],
    ['stock::INFY.NS', { currency: 'INR', points: [{ date: '2024-01-04', close: 1600 }] }],
  ])
  const h = buildHistory({ trades, prices, baseCurrency: 'INR', fx, end: '2024-01-06' })

  it('has one point per day from the first trade', () => {
    expect(h.map((p) => p.date)).toEqual(['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06'])
  })
  it('values holdings at the last close on or before each day', () => {
    expect(h[0].value).toBeCloseTo(10 * 101 * 80)
    expect(h[1].value).toBeCloseTo(10 * 101 * 80) // carry forward
    expect(h[2].value).toBeCloseTo(10 * 101 * 80 + 5 * 1600)
    expect(h[4].value).toBeCloseTo(10 * 110 * 80 + 5 * 1600)
  })
  it('tracks cost basis in base at trade-date FX', () => {
    expect(h[4].costBasis).toBeCloseTo(1000 * 80 + 7500)
    expect(h.every((p) => !p.partial)).toBe(true)
  })
  it('falls back to last trade price when no close exists yet', () => {
    const h2 = buildHistory({ trades, prices: new Map(), baseCurrency: 'INR', fx, end: '2024-01-02' })
    expect(h2[0].value).toBeCloseTo(1000 * 80)
    expect(h2[0].partial).toBe(true)
  })
  it('returns nothing without trades', () => {
    expect(buildHistory({ trades: [], prices, baseCurrency: 'INR', fx, end: '2024-01-06' })).toEqual([])
  })
})

describe('xirr', () => {
  it('10% over exactly one year', () => {
    const r = xirr([
      { date: '2023-01-01', amount: -1000 },
      { date: '2024-01-01', amount: 1100 },
    ])
    expect(r).toBeCloseTo(0.1, 2)
  })
  it('matches a known spreadsheet value', () => {
    // Excel XIRR({-10000, 2750, 4250, 3250, 2750}, {2008-01-01, 2008-03-01, 2008-10-30, 2009-02-15, 2009-04-01}) = 0.373362535
    const r = xirr([
      { date: '2008-01-01', amount: -10000 },
      { date: '2008-03-01', amount: 2750 },
      { date: '2008-10-30', amount: 4250 },
      { date: '2009-02-15', amount: 3250 },
      { date: '2009-04-01', amount: 2750 },
    ])
    expect(r).toBeCloseTo(0.373362535, 4)
  })
  it('handles losses', () => {
    const r = xirr([
      { date: '2023-01-01', amount: -1000 },
      { date: '2024-01-01', amount: 800 },
    ])
    expect(r).toBeCloseTo(-0.2, 2)
  })
  it('undefined without a sign change', () => {
    expect(xirr([{ date: '2023-01-01', amount: -1 }, { date: '2024-01-01', amount: -1 }])).toBeUndefined()
  })
  it('cash flows include current value', () => {
    const { flows: tradeFlows } = replay(trades, { baseCurrency: 'INR', fx })
    const flows = xirrFlows({ flows: tradeFlows, cash: [], baseCurrency: 'INR', fx, currentValue: 100000, asOf: '2025-01-04' })
    expect(flows).toEqual([
      { date: '2024-01-02', amount: -80000 },
      { date: '2024-01-04', amount: -7500 },
      { date: '2025-01-04', amount: 100000 },
    ])
  })
})
