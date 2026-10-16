import { describe, it, expect } from 'vitest'
import { derivePositions, heldOn, replay, type TradeLike } from '../positions'
import { buildHistory } from '../history'
import { cashBalances, summarizeMoney, xirrFlows } from '../money'
import { makeFxLookup } from '../../fx/rates'

const t = (
  date: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  price: number,
  o: Partial<TradeLike> = {}
): TradeLike => ({
  id: `${date}-${side}-${quantity}`,
  occurredAt: `${date}T10:00:00Z`,
  asset: { symbol: 'INFY.NS', type: 'stock' },
  side,
  quantity,
  price,
  currency: 'INR',
  platform: 'Zerodha',
  ...o,
})

const lots = [t('2024-01-01', 'BUY', 10, 100), t('2024-06-01', 'BUY', 10, 200)]

describe('cost methods', () => {
  it('FIFO sells the oldest lot first', () => {
    const { positions, realizations } = replay([...lots, t('2024-09-01', 'SELL', 10, 250)], { includeClosed: true })
    expect(realizations).toHaveLength(1)
    expect(realizations[0].pnl).toBeCloseTo(10 * 150)
    expect(realizations[0].openedAt).toBe('2024-01-01T10:00:00Z')
    expect(positions[0].avgCost).toBeCloseTo(200)
  })

  it('average pools cost but keeps lot dates', () => {
    const { positions, realizations } = replay([...lots, t('2024-09-01', 'SELL', 10, 250)], { method: 'average' })
    expect(realizations[0].pnl).toBeCloseTo(10 * 100)
    expect(realizations[0].openedAt).toBe('2024-01-01T10:00:00Z')
    expect(positions[0].avgCost).toBeCloseTo(150)
  })

  it('a sell spanning two lots makes two slices', () => {
    const { realizations } = replay([...lots, t('2024-09-01', 'SELL', 15, 250, { fees: 15 })])
    expect(realizations.map((r) => r.quantity)).toEqual([10, 5])
    // fees spread per unit: 1 each
    expect(realizations[0].pnl).toBeCloseTo(10 * (249 - 100))
    expect(realizations[1].pnl).toBeCloseTo(5 * (249 - 200))
  })

  it('buy fees go into the lot cost', () => {
    const [p] = derivePositions([t('2024-01-01', 'BUY', 10, 100, { fees: 20 })])
    expect(p.avgCost).toBeCloseTo(102)
    expect(p.costBasis).toBeCloseTo(1020)
  })
})

describe('platforms', () => {
  it('keeps lots per platform: a sell on one never touches the other', () => {
    const { positions, realizations } = replay([
      t('2024-01-01', 'BUY', 10, 100, { platform: 'Groww' }),
      t('2024-02-01', 'BUY', 10, 200),
      t('2024-03-01', 'SELL', 5, 300),
    ])
    expect(realizations[0].pnl).toBeCloseTo(5 * 100)
    expect(positions.find((p) => p.platform === 'Groww')?.quantity).toBe(10)
    expect(positions.find((p) => p.platform === 'Zerodha')?.quantity).toBe(5)
  })

  it('heldOn counts units on a date for one platform', () => {
    const trades = [t('2024-01-01', 'BUY', 10, 100), t('2024-03-01', 'SELL', 4, 100)]
    expect(heldOn(trades, { symbol: 'INFY.NS', type: 'stock' }, 'Zerodha', '2024-02-01')).toBe(10)
    expect(heldOn(trades, { symbol: 'INFY.NS', type: 'stock' }, 'Zerodha', '2024-03-01')).toBe(6)
    expect(heldOn(trades, { symbol: 'INFY.NS', type: 'stock' }, 'Groww', '2024-03-01')).toBe(0)
  })
})

describe('oversell', () => {
  it('stocks never go short: the excess is recorded, not traded', () => {
    const { positions, flows } = replay([t('2024-01-01', 'BUY', 5, 100), t('2024-01-02', 'SELL', 8, 120, { fees: 8 })], {
      includeClosed: true,
    })
    expect(positions[0].quantity).toBe(0)
    expect(positions[0].oversold).toBe(3)
    // only 5 of 8 units sold; fees prorated
    expect(flows[1].cash).toBeCloseTo(5 * 120 - 5)
  })
})

const nifty = (o: Partial<TradeLike> & Pick<TradeLike, 'side' | 'quantity' | 'price'>): TradeLike => ({
  occurredAt: '2026-10-01T05:00:00Z',
  asset: { symbol: 'NIFTY26OCT24500CE', type: 'option' },
  currency: 'INR',
  platform: 'Zerodha',
  contract: { underlying: 'NIFTY', expiry: '2026-10-27', strike: 24500, optionType: 'CE', lotSize: 65 },
  ...o,
})

describe('options and futures', () => {
  it('selling first opens a short; buying back realizes premium kept', () => {
    const { positions, realizations } = replay(
      [nifty({ side: 'SELL', quantity: 65, price: 100 }), nifty({ side: 'BUY', quantity: 65, price: 40, occurredAt: '2026-10-10T05:00:00Z' })],
      { includeClosed: true }
    )
    expect(realizations[0].direction).toBe('short')
    expect(realizations[0].pnl).toBeCloseTo(65 * 60)
    expect(positions[0].closed).toBe(true)
  })

  it('an open short shows negative quantity and cost', () => {
    const [p] = derivePositions([nifty({ side: 'SELL', quantity: 130, price: 100, fees: 13 })])
    expect(p.quantity).toBe(-130)
    expect(p.costBasis).toBeCloseTo(-(130 * 100 - 13))
    expect(p.avgCost).toBeCloseTo(99.9)
  })

  it('settles expired contracts at the settlement price', () => {
    const { positions, realizations, flows } = replay([nifty({ side: 'BUY', quantity: 65, price: 100 })], {
      asOf: '2026-11-01',
      includeClosed: true,
      settlement: () => 30,
    })
    expect(positions[0].closed).toBe(true)
    expect(realizations[0].settled).toBe(true)
    expect(realizations[0].pnl).toBeCloseTo(65 * (30 - 100))
    expect(flows[1].cash).toBeCloseTo(65 * 30)
  })

  it('marks expired contracts without a price as unsettled', () => {
    const [p] = derivePositions([nifty({ side: 'BUY', quantity: 65, price: 100 })], { asOf: '2026-11-01' })
    expect(p.unsettled).toBe(true)
    expect(p.quantity).toBe(65)
  })

  it('futures move cash only by realized P&L', () => {
    const fut = (side: 'BUY' | 'SELL', price: number, day: string): TradeLike => ({
      occurredAt: `${day}T05:00:00Z`,
      asset: { symbol: 'NIFTY26OCTFUT', type: 'future' },
      side,
      quantity: 65,
      price,
      currency: 'INR',
      contract: { underlying: 'NIFTY', expiry: '2026-10-27' },
    })
    const { flows } = replay([fut('BUY', 24000, '2026-10-01'), fut('SELL', 24100, '2026-10-05')])
    expect(flows.map((f) => f.cash)).toEqual([0, 6500])
  })
})

describe('money', () => {
  const fx = makeFxLookup([{ date: '2024-01-01', currency: 'INR', usdPerUnit: 0.0125 }])

  it('net invested drops by the full proceeds, so profit stays visible', () => {
    const { flows } = replay([t('2024-01-01', 'BUY', 10, 100), t('2024-02-01', 'SELL', 10, 150)], { baseCurrency: 'INR', fx })
    const m = summarizeMoney({ flows, cash: [], baseCurrency: 'INR', fx })
    expect(m.bought).toBe(1000)
    expect(m.sold).toBe(1500)
    expect(m.netInvested).toBe(-500)
  })

  it('income and charges come from cash entries in base currency', () => {
    const m = summarizeMoney({
      flows: [],
      cash: [
        { occurredAt: '2024-03-01T00:00:00Z', kind: 'dividend', amount: 10, currency: 'USD', assetSymbol: 'AAPL' },
        { occurredAt: '2024-03-01T00:00:00Z', kind: 'fee', amount: 100, currency: 'INR' },
        { occurredAt: '2024-03-01T00:00:00Z', kind: 'deposit', amount: 5000, currency: 'INR' },
      ],
      baseCurrency: 'INR',
      fx,
    })
    expect(m.dividends).toBeCloseTo(800)
    expect(m.charges).toBe(100)
    expect(m.deposits).toBe(5000)
  })

  it('cash balance only for platforms with deposits, using the broker rate currency', () => {
    const { flows } = replay([
      t('2024-01-02', 'BUY', 1, 100, { asset: { symbol: 'AAPL', type: 'stock' }, currency: 'USD', fxRate: 83, fxQuote: 'INR', platform: 'Vested' }),
      t('2024-01-02', 'BUY', 1, 100),
    ])
    const b = cashBalances(flows, [
      { occurredAt: '2024-01-01T00:00:00Z', kind: 'deposit', amount: 10000, currency: 'INR', platform: 'Vested' },
    ])
    expect(b).toEqual([{ platform: 'Vested', currency: 'INR', amount: 10000 - 8300 }])
  })

  it('xirr flows include income', () => {
    const { flows } = replay([t('2024-01-01', 'BUY', 10, 100)], { baseCurrency: 'INR', fx })
    const f = xirrFlows({
      flows,
      cash: [{ occurredAt: '2024-06-01T10:00:00Z', kind: 'dividend', amount: 50, currency: 'INR', assetSymbol: 'INFY.NS' }],
      baseCurrency: 'INR',
      fx,
      currentValue: 1100,
      asOf: '2025-01-01',
    })
    expect(f).toEqual([
      { date: '2024-01-01', amount: -1000 },
      { date: '2024-06-01', amount: 50 },
      { date: '2025-01-01', amount: 1100 },
    ])
  })
})

describe('history', () => {
  const fx = makeFxLookup([])
  const prices = new Map([
    ['stock::INFY.NS', { currency: 'INR', points: [{ date: '2024-01-01', close: 100 }, { date: '2024-01-02', close: 150 }] }],
  ])

  it('invested falls by sale proceeds and value minus invested is total gain', () => {
    const h = buildHistory({
      trades: [t('2024-01-01', 'BUY', 10, 100), t('2024-01-02', 'SELL', 5, 150)],
      prices,
      baseCurrency: 'INR',
      fx,
      end: '2024-01-02',
    })
    expect(h[1].invested).toBe(1000 - 750)
    expect(h[1].value).toBe(750)
    expect(h[1].value - h[1].invested).toBe(500)
    expect(h[1].costBasis).toBe(500)
  })

  it('benchmark buys the index with the same money', () => {
    const h = buildHistory({
      trades: [t('2024-01-01', 'BUY', 10, 100)],
      prices,
      baseCurrency: 'INR',
      fx,
      end: '2024-01-02',
      benchmark: { currency: 'INR', points: [{ date: '2024-01-01', close: 1000 }, { date: '2024-01-02', close: 1100 }] },
    })
    expect(h[0].benchmark).toBeCloseTo(1000)
    expect(h[1].benchmark).toBeCloseTo(1100)
  })
})
