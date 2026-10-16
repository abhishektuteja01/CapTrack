import { describe, it, expect } from 'vitest'
import { derivePositions, type TradeLike } from '../positions'
import { makeFxLookup } from '../../fx/rates'

const buy = (o: Partial<TradeLike> & Pick<TradeLike, 'occurredAt' | 'quantity' | 'price'>): TradeLike => ({
  asset: { symbol: 'AAPL', type: 'stock' },
  side: 'BUY',
  currency: 'USD',
  ...o,
})
const sell = (o: Partial<TradeLike> & Pick<TradeLike, 'occurredAt' | 'quantity' | 'price'>): TradeLike =>
  buy({ side: 'SELL', ...o })

describe('realized P&L', () => {
  it('partial sell books gain net of fees and keeps avg cost', () => {
    const [pos] = derivePositions([
      buy({ occurredAt: '2024-01-01', quantity: 100, price: 10, fees: 10 }),
      sell({ occurredAt: '2024-02-01', quantity: 40, price: 15, fees: 4 }),
    ])
    // avg cost 10.10; removed 404; proceeds 600 - 4
    expect(pos.quantity).toBe(60)
    expect(pos.avgCost).toBeCloseTo(10.1)
    expect(pos.realized).toBeCloseTo(600 - 4 - 404)
  })

  it('full sell is excluded by default and kept with includeClosed', () => {
    const trades = [
      buy({ occurredAt: '2024-01-01', quantity: 10, price: 100 }),
      sell({ occurredAt: '2024-03-01', quantity: 10, price: 80, fees: 1 }),
    ]
    expect(derivePositions(trades)).toHaveLength(0)
    const [closed] = derivePositions(trades, { includeClosed: true })
    expect(closed.closed).toBe(true)
    expect(closed.costBasis).toBe(0)
    expect(closed.realized).toBeCloseTo(800 - 1 - 1000)
  })

  it('oversell is clamped: realized only counts held units and their share of fees', () => {
    const [pos] = derivePositions(
      [
        buy({ occurredAt: '2024-01-01', quantity: 5, price: 10 }),
        sell({ occurredAt: '2024-01-02', quantity: 8, price: 12, fees: 2 }),
      ],
      { includeClosed: true }
    )
    expect(pos.quantity).toBe(0)
    expect(pos.realized).toBeCloseTo(5 * 12 - 2 * (5 / 8) - 50)
    expect(pos.oversold).toBe(3)
  })
})

describe('base currency', () => {
  const fx = makeFxLookup([
    { date: '2024-01-01', currency: 'INR', usdPerUnit: 1 / 83 },
    { date: '2024-06-01', currency: 'INR', usdPerUnit: 1 / 84 },
    { date: '2024-01-01', currency: 'EUR', usdPerUnit: 1.1 },
  ])

  it('converts cost basis at trade-date FX and realized at sell-date FX', () => {
    const [pos] = derivePositions(
      [
        buy({ occurredAt: '2024-01-15', quantity: 10, price: 100 }),
        sell({ occurredAt: '2024-07-01', quantity: 5, price: 120 }),
      ],
      { baseCurrency: 'INR', fx }
    )
    // bought 1000 USD at 83 → 83,000 INR; sold half: removed 41,500, proceeds 600*84 = 50,400
    expect(pos.costBasisBase).toBeCloseTo(41500)
    expect(pos.realizedBase).toBeCloseTo(50400 - 41500)
  })

  it('uses the trade fxRate override when it quotes the base currency', () => {
    const [pos] = derivePositions(
      [buy({ occurredAt: '2024-01-15', quantity: 1, price: 100, fxRate: 82.5, fxQuote: 'INR' })],
      { baseCurrency: 'INR', fx }
    )
    expect(pos.costBasisBase).toBeCloseTo(8250)
  })

  it('cross rate goes through USD', () => {
    const [pos] = derivePositions(
      [buy({ occurredAt: '2024-02-01', quantity: 1, price: 100, currency: 'EUR' })],
      { baseCurrency: 'INR', fx }
    )
    expect(pos.costBasisBase).toBeCloseTo(100 * 1.1 * 83)
  })

  it('leaves base figures undefined when a rate is missing', () => {
    const [pos] = derivePositions(
      [buy({ occurredAt: '2024-02-01', quantity: 1, price: 100, currency: 'BRL' })],
      { baseCurrency: 'INR', fx }
    )
    expect(pos.costBasisBase).toBeUndefined()
    expect(pos.costBasis).toBe(100)
  })

  it('flags mixed currencies for one symbol', () => {
    const [pos] = derivePositions(
      [
        buy({ occurredAt: '2024-01-01', quantity: 1, price: 100 }),
        buy({ occurredAt: '2024-01-02', quantity: 1, price: 100, currency: 'EUR' }),
      ],
      { baseCurrency: 'USD', fx }
    )
    expect(pos.mixedCurrency).toBe(true)
    expect(pos.costBasisBase).toBeCloseTo(100 + 110)
  })
})
