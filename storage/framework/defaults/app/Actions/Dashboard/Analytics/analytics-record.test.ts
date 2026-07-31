import { describe, expect, test } from 'bun:test'
import {
  analyticsCurrency,
  analyticsIdentifier,
  analyticsNumber,
  analyticsOptionalNumber,
  analyticsOptionalString,
  analyticsString,
  analyticsTimestamp,
} from './analytics-record'

describe('analytics model record validation', () => {
  test('normalizes valid identifiers, currencies, numbers, and timestamps', () => {
    expect(analyticsIdentifier(42, 'Order')).toBe('42')
    expect(analyticsIdentifier(' row-1 ', 'Order')).toBe('row-1')
    expect(analyticsCurrency(' usd ', 'Order')).toBe('USD')
    expect(analyticsNumber('12.50', 'Order', 'total', { min: 0 })).toBe(12.5)
    expect(analyticsTimestamp('2026-07-29 12:00:00', 'Order')).toBe('2026-07-29T12:00:00.000Z')
  })

  test('distinguishes nullable values from recorded zeroes', () => {
    expect(analyticsOptionalNumber(null, 'Campaign', 'open_rate')).toBeNull()
    expect(analyticsOptionalNumber(0, 'Campaign', 'open_rate')).toBe(0)
    expect(analyticsOptionalString(null, 'Product', 'category_id')).toBe('')
  })

  test('rejects coercive or out-of-range stored values', () => {
    expect(() => analyticsNumber('', 'Payment', 'amount')).toThrow('Payment.amount must be a finite number')
    expect(() => analyticsNumber('0x10', 'Payment', 'amount')).toThrow('Payment.amount must be a finite number')
    expect(() => analyticsNumber(101, 'Campaign', 'open_rate', { max: 100 })).toThrow('at most 100')
    expect(() => analyticsString({}, 'Event', 'name')).toThrow('Event.name must be a non-empty string')
    expect(() => analyticsCurrency('US', 'Order')).toThrow('three-letter currency code')
    expect(() => analyticsTimestamp('not-a-date', 'Order')).toThrow('valid timestamp')
  })
})
