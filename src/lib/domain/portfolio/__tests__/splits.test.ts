import { describe, it, expect } from 'vitest'
import { derivePositions, type TradeLike } from '../positions'
import { buildHistory } from '../history'
import { detectImpliedSplits, mergeSplits, unadjustForSplits } from '../splits'
import { makeFxLookup } from '../../fx/rates'

const t = (date: string, side: 'BUY' | 'SELL', quantity: number, price: number): TradeLike => ({
  occurredAt: `${date}T10:00:00Z`,
  asset: { symbol: 'SILVER1.NS', type: 'etf' },
  side,
  quantity,
  price,
  currency: 'INR',
})
const splits = new Map([['etf::SILVER1.NS', [{ date: '2026-02-27', ratio: 10 }]]])

describe('splits in positions', () => {
  it('multiplies units bought before the split and keeps total cost', () => {
    const [p] = derivePositions([t('2025-06-01', 'BUY', 400, 111.77)], { splits })
    expect(p.quantity).toBe(4000)
    expect(p.costBasis).toBeCloseTo(44708)
    expect(p.avgCost).toBeCloseTo(11.177)
    expect(p.splits).toHaveLength(1)
  })
  it('leaves trades after the split alone', () => {
    const [p] = derivePositions([t('2026-03-01', 'BUY', 400, 25)], { splits })
    expect(p.quantity).toBe(400)
    expect(p.splits).toHaveLength(0)
  })
  it('a sell after the split uses post-split units and cost', () => {
    const [p] = derivePositions(
      [t('2025-06-01', 'BUY', 100, 200), t('2026-03-02', 'SELL', 500, 25)],
      { splits, includeClosed: true }
    )
    expect(p.quantity).toBe(500)
    expect(p.realized).toBeCloseTo(500 * 25 - 500 * 20)
  })
  it('respects asOf', () => {
    const [p] = derivePositions([t('2025-06-01', 'BUY', 400, 111.77)], { splits, asOf: '2026-01-01' })
    expect(p.quantity).toBe(400)
  })
})

describe('splits in history', () => {
  it('keeps value continuous across the split with an unadjusted series', () => {
    const fx = makeFxLookup([])
    const prices = new Map([
      ['etf::SILVER1.NS', { currency: 'INR', points: [{ date: '2026-02-26', close: 250 }, { date: '2026-02-27', close: 25 }] }],
    ])
    const h = buildHistory({ trades: [t('2026-02-26', 'BUY', 10, 250)], prices, baseCurrency: 'INR', fx, end: '2026-02-27', splits })
    expect(h[0].value).toBeCloseTo(2500)
    expect(h[1].value).toBeCloseTo(2500)
  })
})

describe('series helpers', () => {
  it('detects a 10:1 jump', () => {
    const s = detectImpliedSplits([{ date: '2026-02-26', close: 249.55 }, { date: '2026-02-27', close: 25.75 }])
    expect(s).toEqual([{ date: '2026-02-27', ratio: 10, source: 'detected' }])
  })
  it('ignores a 50% crash', () => {
    expect(detectImpliedSplits([{ date: 'a', close: 100 }, { date: 'b', close: 50 }])).toEqual([])
  })
  it('detects a 1:10 reverse split', () => {
    expect(detectImpliedSplits([{ date: 'a', close: 2 }, { date: 'b', close: 20.4 }])[0].ratio).toBeCloseTo(0.1)
  })
  it('unadjusts a split-adjusted series', () => {
    const pts = [{ date: '2024-06-07', close: 120.89 }, { date: '2024-06-10', close: 121.79 }]
    expect(unadjustForSplits(pts, [{ date: '2024-06-10', ratio: 10 }])[0].close).toBeCloseTo(1208.9)
  })
  it('leaves an already-jumping series alone', () => {
    const pts = [{ date: 'a', close: 250 }, { date: 'b', close: 25 }]
    expect(unadjustForSplits(pts, [{ date: 'b', ratio: 10 }])).toEqual(pts)
  })
  it('reported splits win over detected ones on the same day', () => {
    const m = mergeSplits([{ date: 'b', ratio: 10, source: 'detected' }], [{ date: 'b', ratio: 10, source: 'yahoo' }])
    expect(m).toEqual([{ date: 'b', ratio: 10, source: 'yahoo' }])
  })
})
