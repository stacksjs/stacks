import { describe, expect, test } from 'bun:test'
import { formatAmount, minorUnitExponent } from '../src/payment'

/**
 * Provider amounts are in the currency's minor unit, and not every currency
 * has two decimals. formatAmount divided every amount by 100, so 1000 JPY
 * showed as ¥10. Stripe's table is from https://docs.stripe.com/currencies:
 * its zero-decimal list, and ISK and UGX written as two-decimal amounts
 * ("to charge 5 ISK, provide an amount value of 500").
 */
const shown = (major: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major)

describe('formatAmount scales by the currency, not by 100', () => {
  test('a zero-decimal currency is not divided at all', () => {
    expect(formatAmount(1000, 'jpy')).toBe(shown(1000, 'JPY'))
    expect(formatAmount(50000, 'KRW')).toBe(shown(50000, 'KRW'))
    // MGA has two ISO decimals, but Stripe takes it whole.
    expect(formatAmount(5000, 'mga')).toBe(shown(5000, 'MGA'))
  })

  test('ISK and UGX are written in hundredths, as Stripe asks', () => {
    expect(formatAmount(500, 'isk')).toBe(shown(5, 'ISK'))
    expect(formatAmount(500, 'ugx')).toBe(shown(5, 'UGX'))
  })

  test('a two-decimal currency still reads as before', () => {
    expect(formatAmount(1999, 'usd')).toBe('$19.99')
    expect(formatAmount(2000, 'eur')).toBe(shown(20, 'EUR'))
  })
})

describe('minorUnitExponent', () => {
  test('follows Stripe\'s table on the Stripe driver', () => {
    expect(['jpy', 'krw', 'mga', 'vnd', 'xof', 'isk', 'ugx', 'usd', 'huf', 'twd'].map(c => minorUnitExponent(c, 'stripe')))
      .toEqual([0, 0, 0, 0, 0, 2, 2, 2, 2, 2])
  })

  test('follows ISO 4217 on any other driver', () => {
    expect(['jpy', 'isk', 'ugx', 'mga', 'kwd', 'usd'].map(c => minorUnitExponent(c, 'adyen')))
      .toEqual([0, 0, 0, 2, 3, 2])
  })
})
