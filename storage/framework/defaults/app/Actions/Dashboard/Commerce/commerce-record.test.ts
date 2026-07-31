import { describe, expect, test } from 'bun:test'
import {
  commerceBoolean,
  commerceCurrency,
  commerceEmail,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalNumber,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceUrl,
} from './commerce-record'

describe('commerce model record validation', () => {
  test('normalizes recorded scalar values', () => {
    expect(commerceIdentifier(7, 'Product')).toBe('7')
    expect(commerceRequiredString(' Widget ', 'Product 7', 'name')).toBe('Widget')
    expect(commerceOptionalString(null, 'Product 7', 'description')).toBe('')
    expect(commerceNumber('12.50', 'Product 7', 'price', { min: 0 })).toBe(12.5)
    expect(commerceOptionalNumber(null, 'Product 7', 'discount')).toBeNull()
    expect(commerceBoolean('0', 'Product 7', 'is_available')).toBeFalse()
    expect(commerceEnum('active', 'TaxRate 1', 'status', ['active', 'inactive'])).toBe('active')
    expect(commerceCurrency(' usd ', 'Order 1')).toBe('USD')
    expect(commerceEmail('customer@example.com', 'Customer 1')).toBe('customer@example.com')
    expect(commerceUrl('https://example.com/avatar.png', 'Customer 1', 'avatar')).toBe('https://example.com/avatar.png')
    expect(commerceTimestamp('2026-07-29 12:00:00', 'Order 1')).toBe('2026-07-29T12:00:00.000Z')
    expect(commerceOptionalTimestamp(null, 'Customer 1', 'last_order')).toBe('')
  })

  test('rejects coercive and invalid values', () => {
    expect(() => commerceNumber('', 'Product 7', 'price')).toThrow('finite number')
    expect(() => commerceNumber('0x10', 'Product 7', 'price')).toThrow('finite number')
    expect(() => commerceBoolean(null, 'Product 7', 'is_available')).toThrow('boolean')
    expect(() => commerceEnum('legacy', 'TaxRate 1', 'status', ['active', 'inactive']))
      .toThrow('active or inactive')
    expect(() => commerceCurrency('US', 'Order 1')).toThrow('three-letter currency code')
    expect(() => commerceEmail('not-an-email', 'Customer 1')).toThrow('valid email address')
    expect(() => commerceUrl('javascript:alert(1)', 'Customer 1', 'avatar')).toThrow('valid HTTP or HTTPS URL')
    expect(() => commerceTimestamp('not-a-date', 'Order 1')).toThrow('valid timestamp')
  })
})
