import { describe, it, expect } from 'vitest'
import { derivePositions } from '../positions'

describe('derivePositions', () => {
  it('simple BUY sets correct quantity, costBasis, and avgCost', () => {
    const trades = [{
      occurredAt: '2024-01-01T00:00:00Z',
      asset: { symbol: 'AAPL', type: 'stock' },
      side: 'BUY' as const,
      quantity: 100,
      price: 10,
      fees: 5,
    }]

    const positions = derivePositions(trades)
    const pos = positions[0]

    expect(pos.quantity).toBe(100)
    expect(pos.costBasis).toBe(1005)
    expect(pos.avgCost).toBe(10.05)
    expect(pos.totalFees).toBe(5)
  })
  it('BUY then partial SELL reduces quantity and costBasis correctly', () => {
    const trades = [
      {
        occurredAt: '2024-01-01T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'BUY' as const,
        quantity: 100,
        price: 10,
        fees: 0,
      },
      {
        occurredAt: '2024-01-02T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'SELL' as const,
        quantity: 50,
        price: 12,
        fees: 0,
      }
    ]

    const positions = derivePositions(trades)
    const pos = positions[0]

    expect(pos.quantity).toBe(50)
    expect(pos.costBasis).toBe(500)
    expect(pos.avgCost).toBe(10)
  })
  it('full SELL results in zero quantity and zero costBasis', () => {
    const trades = [
      {
        occurredAt: '2024-01-01T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'BUY' as const,
        quantity: 100,
        price: 10,
        fees: 0,
      },
      {
        occurredAt: '2024-01-02T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'SELL' as const,
        quantity: 100,
        price: 12,
        fees: 0,
      }
    ]

    const positions = derivePositions(trades)
    expect(positions).toHaveLength(0)
  })
  it('SELL exceeding available quantity is clamped to zero, not negative', () => {
    const trades = [
      {
        occurredAt: '2024-01-01T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'BUY' as const,
        quantity: 50,
        price: 10,
        fees: 0,
      },
      {
        occurredAt: '2024-01-02T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'SELL' as const,
        quantity: 100,
        price: 12,
        fees: 0,
      }
    ]

    const positions = derivePositions(trades)

    expect(positions).toHaveLength(0)
  })
  it('multiple BUYs at different prices produce correct average cost', () => {
    const trades = [
      {
        occurredAt: '2024-01-01T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'BUY' as const,
        quantity: 100,
        price: 10,
        fees: 0,
      },
      {
        occurredAt: '2024-01-02T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'BUY' as const,
        quantity: 100,
        price: 20,
        fees: 0,
      }
    ]

    const positions = derivePositions(trades)
    const pos = positions[0]

    expect(pos.quantity).toBe(200)
    expect(pos.costBasis).toBe(3000)
    expect(pos.avgCost).toBe(15)
  })
  it('fees accumulate correctly across multiple trades', () => {
    const trades = [
      {
        occurredAt: '2024-01-01T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'BUY' as const,
        quantity: 100,
        price: 10,
        fees: 5,
      },
      {
        occurredAt: '2024-01-02T00:00:00Z',
        asset: { symbol: 'AAPL', type: 'stock' },
        side: 'SELL' as const,
        quantity: 50,
        price: 12,
        fees: 3,
      }
    ]

    const positions = derivePositions(trades)
    const pos = positions[0]

    expect(pos.totalFees).toBe(8)
  })
})