import { describe, it, expect } from 'vitest'
import { money, moneyDelta, pct, qty, compactMoney, price, MINUS, NONE } from '../format'

describe('format', () => {
  it('INR uses Indian grouping', () => expect(money(1234567.5, 'INR')).toBe('₹12,34,567.50'))
  it('USD', () => expect(money(1234567.5, 'USD')).toBe('$1,234,567.50'))
  it('EUR', () => expect(money(1234.5, 'EUR')).toBe('€1,234.50'))
  it('JPY has no decimals', () => expect(money(1234.5, 'JPY')).toMatch(/^[￥¥]1,235$/))
  it('decimals override', () => expect(money(2699548.7, 'INR', 0)).toBe('₹26,99,549'))
  it('negative uses a true minus', () => expect(money(-5, 'USD')).toBe(`${MINUS}$5.00`))
  it('unknown is a dash', () => {
    expect(money(undefined, 'USD')).toBe(NONE)
    expect(pct(NaN)).toBe(NONE)
  })
  it('delta has explicit sign', () => {
    expect(moneyDelta(1200, 'INR', 0)).toBe('+₹1,200')
    expect(moneyDelta(-1200, 'INR', 0)).toBe(`${MINUS}₹1,200`)
    expect(moneyDelta(0, 'INR', 0)).toBe('₹0')
  })
  it('pct', () => {
    expect(pct(1.234)).toBe('+1.23%')
    expect(pct(-0.5)).toBe(`${MINUS}0.50%`)
    expect(pct(12.3, 1, false)).toBe('12.3%')
  })
  it('qty trims zeros', () => expect(qty(0.125)).toBe('0.125'))
  it('compact INR uses lakh', () => expect(compactMoney(2700000, 'INR')).toBe('₹27L'))
  it('unknown ISO code falls back', () => expect(money(10, 'XYZ1')).toBe('10.00 XYZ1'))
  it('sub-1 prices keep 4 decimals', () => expect(price(0.1234, 'USD')).toBe('$0.1234'))
})
