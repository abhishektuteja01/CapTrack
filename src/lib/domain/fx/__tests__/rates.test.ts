import { describe, it, expect } from 'vitest'
import { makeFxLookup, normalizeCurrency } from '../rates'

describe('makeFxLookup', () => {
  const fx = makeFxLookup([
    { date: '2024-01-05', currency: 'INR', usdPerUnit: 0.012 },
    { date: '2024-01-08', currency: 'INR', usdPerUnit: 0.0125 },
    { date: '2024-01-05', currency: 'EUR', usdPerUnit: 1.1 },
  ])

  it('same currency is 1', () => expect(fx('JPY', 'JPY', '2024-01-01')).toBe(1))
  it('carries the last rate forward over weekends', () =>
    expect(fx('INR', 'USD', '2024-01-07')).toBe(0.012))
  it('uses the exact day when present', () => expect(fx('INR', 'USD', '2024-01-08')).toBe(0.0125))
  it('uses the first rate for dates before history', () =>
    expect(fx('INR', 'USD', '2023-12-01')).toBe(0.012))
  it('inverts through USD', () => expect(fx('USD', 'INR', '2024-01-05')).toBeCloseTo(1 / 0.012))
  it('crosses through USD', () => expect(fx('EUR', 'INR', '2024-01-05')).toBeCloseTo(1.1 / 0.012))
  it('unknown currency is undefined', () => expect(fx('XYZ', 'USD', '2024-01-05')).toBeUndefined())
})

describe('normalizeCurrency', () => {
  it('pence to pounds', () => expect(normalizeCurrency('GBp')).toEqual({ currency: 'GBP', factor: 0.01 }))
  it('pounds stay pounds', () => expect(normalizeCurrency('GBP')).toEqual({ currency: 'GBP', factor: 1 }))
  it('rand cents', () => expect(normalizeCurrency('ZAc')).toEqual({ currency: 'ZAR', factor: 0.01 }))
  it('agorot', () => expect(normalizeCurrency('ILA')).toEqual({ currency: 'ILS', factor: 0.01 }))
})
