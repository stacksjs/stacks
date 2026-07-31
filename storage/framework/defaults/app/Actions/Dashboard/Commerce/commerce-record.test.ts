import { describe, expect, test } from 'bun:test'
import {
  commerceBoolean,
  commerceCurrency,
  commerceDate,
  commerceEmail,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalEmail,
  commerceOptionalNumber,
  commerceOptionalDate,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceStringList,
  commerceTimestamp,
  commerceUrl,
} from './commerce-record'

describe('commerce model record validation', () => {
  test('normalizes recorded scalar values', () => {
    expect(commerceIdentifier(7, 'Product')).toBe('7')
    expect(commerceOptionalIdentifier(null, 'Order 1', 'customer_id')).toBe('')
    expect(commerceRequiredString(' Widget ', 'Product 7', 'name')).toBe('Widget')
    expect(commerceOptionalString(null, 'Product 7', 'description')).toBe('')
    expect(commerceStringList('["US","CA","US"]', 'ShippingZone 1', 'countries')).toEqual(['US', 'CA'])
    expect(commerceNumber('12.50', 'Product 7', 'price', { min: 0 })).toBe(12.5)
    expect(commerceOptionalNumber(null, 'Product 7', 'discount')).toBeNull()
    expect(commerceBoolean('0', 'Product 7', 'is_available')).toBeFalse()
    expect(commerceEnum('active', 'TaxRate 1', 'status', ['active', 'inactive'])).toBe('active')
    expect(commerceCurrency(' usd ', 'Order 1')).toBe('USD')
    expect(commerceDate('2026-07-29', 'Coupon 1', 'start_date')).toBe('2026-07-29')
    expect(commerceOptionalDate(null, 'Coupon 1', 'end_date')).toBe('')
    expect(commerceEmail('customer@example.com', 'Customer 1')).toBe('customer@example.com')
    expect(commerceOptionalEmail(null, 'GiftCard 1', 'recipient_email')).toBe('')
    expect(commerceUrl('https://example.com/avatar.png', 'Customer 1', 'avatar')).toBe('https://example.com/avatar.png')
    expect(commerceTimestamp('2026-07-29 12:00:00', 'Order 1')).toBe('2026-07-29T12:00:00.000Z')
    expect(commerceTimestamp(1_788_583_200, 'GiftCard 1', 'last_used_date')).toBe('2026-09-05T04:40:00.000Z')
    expect(commerceOptionalTimestamp(null, 'Customer 1', 'last_order')).toBe('')
  })

  test('rejects coercive and invalid values', () => {
    expect(() => commerceOptionalIdentifier(0, 'Order 1', 'customer_id')).toThrow('positive integer')
    expect(() => commerceNumber('', 'Product 7', 'price')).toThrow('finite number')
    expect(() => commerceNumber('0x10', 'Product 7', 'price')).toThrow('finite number')
    expect(() => commerceBoolean(null, 'Product 7', 'is_available')).toThrow('boolean')
    expect(() => commerceStringList('[\"US\"', 'ShippingZone 1', 'countries')).toThrow('JSON array')
    expect(() => commerceEnum('legacy', 'TaxRate 1', 'status', ['active', 'inactive']))
      .toThrow('active or inactive')
    expect(() => commerceCurrency('US', 'Order 1')).toThrow('three-letter currency code')
    expect(() => commerceDate('2026-02-30', 'Coupon 1', 'start_date')).toThrow('valid YYYY-MM-DD date')
    expect(() => commerceEmail('not-an-email', 'Customer 1')).toThrow('valid email address')
    expect(() => commerceUrl('javascript:alert(1)', 'Customer 1', 'avatar')).toThrow('valid HTTP or HTTPS URL')
    expect(() => commerceTimestamp('not-a-date', 'Order 1')).toThrow('valid timestamp')
  })
})
