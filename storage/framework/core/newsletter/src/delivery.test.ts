import { describe, expect, test } from 'bun:test'
import { allocateDeliveryVariant, assertUsageAvailable, classifyDeliveryFailure, deliveryIdempotencyKey } from './delivery'

describe('channel-neutral delivery primitives', () => {
  test('allocates variants deterministically', () => {
    const variants = [{ id: 'control', allocation: 50 }, { id: 'subject-b', allocation: 50 }]
    expect(allocateDeliveryVariant('contact-42', variants)).toEqual(allocateDeliveryVariant('contact-42', variants))
  })

  test('builds a stable recipient delivery key', () => {
    expect(deliveryIdempotencyKey({ teamId: 2, campaignId: 9, channel: 'sms', recipient: ' +15551234567 ' }))
      .toBe('delivery:2:9:sms:+15551234567:once')
  })

  test('fails closed when quota would be exceeded', () => {
    expect(() => assertUsageAvailable([{ meter: 'email_sends', used: 9999, limit: 10000, requested: 2 }]))
      .toThrow('Usage limit exceeded for email_sends')
    expect(() => assertUsageAvailable([{ meter: 'email_sends', used: 9999, limit: null, requested: 2000 }]))
      .not.toThrow()
  })

  test('classifies retry and suppression boundaries', () => {
    expect(classifyDeliveryFailure(429)).toBe('rate_limited')
    expect(classifyDeliveryFailure(503)).toBe('transient')
    expect(classifyDeliveryFailure(400, 'recipient suppressed')).toBe('suppressed')
    expect(classifyDeliveryFailure(400, 'invalid number')).toBe('permanent')
  })
})
