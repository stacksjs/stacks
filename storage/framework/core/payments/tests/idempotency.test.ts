import { describe, expect, test } from 'bun:test'
import { freshIdempotencyKey, stacksIdempotencyKey } from '../src/idempotency'

describe('stacksIdempotencyKey (stacksjs/stacks#1876 X-1)', () => {
  test('produces a deterministic key for the same inputs', () => {
    const a = stacksIdempotencyKey('customer.create', 42)
    const b = stacksIdempotencyKey('customer.create', 42)
    expect(a).toBe(b)
  })

  test('different scopes produce different keys', () => {
    const a = stacksIdempotencyKey('customer.create', 42)
    const b = stacksIdempotencyKey('subscription.create', 42)
    expect(a).not.toBe(b)
  })

  test('different parts produce different keys', () => {
    const a = stacksIdempotencyKey('customer.create', 42)
    const b = stacksIdempotencyKey('customer.create', 43)
    expect(a).not.toBe(b)
  })

  test('includes the version suffix for future-proofing', () => {
    expect(stacksIdempotencyKey('customer.create', 42)).toMatch(/:v1$/)
  })

  test('drops null/undefined/empty parts', () => {
    const withNulls = stacksIdempotencyKey('subscription.create', 42, null, undefined, '')
    const without = stacksIdempotencyKey('subscription.create', 42)
    expect(withNulls).toBe(without)
  })

  test('coerces numbers and strings into the same key shape', () => {
    expect(stacksIdempotencyKey('checkout', 42, 'price_abc')).toBe(stacksIdempotencyKey('checkout', '42', 'price_abc'))
  })

  test('caps overlong keys at 255 chars via SHA-256 collapse', () => {
    const tail = 'x'.repeat(500)
    const key = stacksIdempotencyKey('long.scope', tail)
    expect(key.length).toBeLessThanOrEqual(255)
    // Should still be deterministic with the same long tail.
    const again = stacksIdempotencyKey('long.scope', tail)
    expect(key).toBe(again)
  })

  test('produces a "stacks:" prefix and "v1" suffix', () => {
    const key = stacksIdempotencyKey('foo', 'bar')
    expect(key.startsWith('stacks:')).toBe(true)
    expect(key.endsWith(':v1')).toBe(true)
  })

  test('omits the trailing colon when no parts are given', () => {
    const key = stacksIdempotencyKey('init')
    expect(key).toBe('stacks:init:v1')
  })
})

describe('freshIdempotencyKey (one-shot variant)', () => {
  test('produces a different key per call', () => {
    const a = freshIdempotencyKey('intent.create', 1)
    const b = freshIdempotencyKey('intent.create', 1)
    expect(a).not.toBe(b)
  })

  test('still has the stacks prefix and v1 suffix', () => {
    const key = freshIdempotencyKey('intent.create', 1)
    expect(key.startsWith('stacks:')).toBe(true)
    expect(key.endsWith(':v1')).toBe(true)
  })

  test('respects the 255-char cap', () => {
    const key = freshIdempotencyKey('intent.create', 'x'.repeat(500))
    expect(key.length).toBeLessThanOrEqual(255)
  })
})
