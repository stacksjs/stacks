import { describe, expect, it } from 'bun:test'
import {
  currencyExponent,
  decimalToMinor,
  formatCurrency,
  formatMinor,
  minorToInput,
  minorToMajor,
  moneyInputError,
  moneyInputStep,
  parseMoneyInput,
  PriceFormatError,
} from '../money'

/**
 * The display and input boundary for every stored amount (stacksjs/stacks#2851).
 *
 * `products.price` and its siblings hold integer minor units. These pin the two
 * conversions people see: a stored integer shown in the currency's precision,
 * and a typed decimal stored as an integer, never as a float.
 */

describe('formatCurrency', () => {
  it('shows minor units in the currency precision', () => {
    expect(formatCurrency(1999, 'USD', 'en-US')).toBe('$19.99')
    expect(formatCurrency(5, 'USD', 'en-US')).toBe('$0.05')
    expect(formatCurrency(0, 'USD', 'en-US')).toBe('$0.00')
    expect(formatCurrency(123456789, 'USD', 'en-US')).toBe('$1,234,567.89')
  })

  it('has no decimals for JPY and three for KWD', () => {
    expect(formatCurrency(1999, 'JPY', 'en-US')).toBe('¥1,999')
    // Intl separates a code from its amount with a no-break space.
    expect(formatCurrency(1999, 'KWD', 'en-US')).toBe('KWD\u00A01.999')
  })

  it('keeps the sign of a negative amount', () => {
    expect(formatCurrency(-1999, 'USD', 'en-US')).toBe('-$19.99')
  })

  it('reads a numeric string the database driver handed back', () => {
    expect(formatCurrency('1999', 'USD', 'en-US')).toBe('$19.99')
  })

  it('rounds a stray fraction of a minor unit rather than showing it', () => {
    expect(formatCurrency(1999.4, 'USD', 'en-US')).toBe('$19.99')
    expect(formatCurrency(1999.5, 'USD', 'en-US')).toBe('$20.00')
  })

  it('falls back to the report form for a code Intl rejects', () => {
    expect(formatCurrency(1999, 'NOT-A-CODE', 'en-US')).toBe('19.99 NOT-A-CODE')
  })
})

describe('minorToMajor and minorToInput', () => {
  it('converts for charts and for prefilling a field', () => {
    expect(minorToMajor(1999, 'USD')).toBe(19.99)
    expect(minorToMajor(1999, 'JPY')).toBe(1999)
    expect(minorToMajor(1999, 'KWD')).toBe(1.999)
    expect(minorToMajor(-250, 'USD')).toBe(-2.5)
    expect(minorToInput(1999, 'USD')).toBe('19.99')
    expect(minorToInput(1999, 'JPY')).toBe('1999')
    expect(minorToInput(1999, 'KWD')).toBe('1.999')
    expect(minorToInput(null, 'USD')).toBe('')
  })

  it('formats signed and fractional amounts for reports', () => {
    expect(formatMinor(-1999, 'USD')).toBe('-19.99 USD')
    expect(formatMinor(1999.6, 'USD')).toBe('20.00 USD')
  })
})

describe('parseMoneyInput', () => {
  it.each([
    ['19.99', 'USD', 1999],
    ['19.9', 'USD', 1990],
    ['19', 'USD', 1900],
    ['0.10', 'USD', 10],
    ['.5', 'USD', 50],
    [' 24.00 ', 'USD', 2400],
    ['1.005', 'KWD', 1005],
    ['1.2', 'KWD', 1200],
    ['1999', 'JPY', 1999],
  ] as const)('stores %p %s as %p', (input, currency, minor) => {
    expect(parseMoneyInput(input, currency)).toBe(minor)
  })

  it('never goes through a float', () => {
    // 4.35 * 100 is 434.99999999999994; 1.005 * 100 rounds to 100.
    expect(Math.round(1.005 * 100)).toBe(100)
    expect(parseMoneyInput('4.35', 'USD')).toBe(435)
    expect(parseMoneyInput('1.01', 'USD')).toBe(101)
    expect(parseMoneyInput(19.99, 'USD')).toBe(1999)
  })

  it('round-trips every cent through the field and back', () => {
    for (let minor = 0; minor <= 10_000; minor++) {
      for (const currency of ['USD', 'JPY', 'KWD']) {
        const shown = minorToInput(minor, currency)
        expect(parseMoneyInput(shown, currency)).toBe(minor)
      }
    }
  })

  it('rejects more decimals than the currency has instead of rounding them away', () => {
    expect(moneyInputError('19.999', 'USD')).toBe('USD amounts have at most 2 decimal places.')
    expect(moneyInputError('1999.5', 'JPY')).toBe('JPY amounts have no decimal places.')
    expect(moneyInputError('1.2345', 'KWD')).toBe('KWD amounts have at most 3 decimal places.')
    expect(() => parseMoneyInput('19.999', 'USD')).toThrow(PriceFormatError)
  })

  it.each(['abc', '1,000.00', '-5', '+5', '1e3', '$19.99', '19.99 USD', '.', 'NaN'])('rejects %p', (input) => {
    expect(moneyInputError(input, 'USD')).not.toBe('')
    expect(() => parseMoneyInput(input, 'USD')).toThrow(PriceFormatError)
  })

  it('treats empty as an error unless the field is optional', () => {
    expect(moneyInputError('', 'USD')).toBe('Enter an amount.')
    expect(() => parseMoneyInput('  ', 'USD')).toThrow('Enter an amount.')
    expect(moneyInputError('', 'USD', { required: false })).toBe('')
    expect(parseMoneyInput('', 'USD', { required: false })).toBeNull()
  })

  it('enforces bounds in minor units', () => {
    expect(moneyInputError('0.00', 'USD', { min: 1 })).toBe('Enter at least 0.01 USD.')
    expect(moneyInputError('0.01', 'USD', { min: 1 })).toBe('')
    expect(moneyInputError('5.01', 'USD', { max: 500 })).toBe('Enter at most 5.00 USD.')
  })

  it('rejects an amount too large to store exactly', () => {
    expect(moneyInputError('99999999999999999.99', 'USD')).toBe('That amount is too large.')
  })
})

describe('moneyInputStep', () => {
  it('matches the currency precision', () => {
    expect(moneyInputStep('USD')).toBe('0.01')
    expect(moneyInputStep('JPY')).toBe('1')
    expect(moneyInputStep('KWD')).toBe('0.001')
  })
})

describe('the import path still reaches the same functions', () => {
  it('re-exports rather than copies', async () => {
    const imports = await import('../imports/money')
    expect(imports.decimalToMinor).toBe(decimalToMinor)
    expect(imports.currencyExponent).toBe(currencyExponent)
    expect(imports.formatMinor).toBe(formatMinor)
  })
})
