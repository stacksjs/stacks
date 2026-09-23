import { afterEach, beforeEach, expect, test } from 'bun:test'
import { RateLimiter } from '../src/rate-limiter'

beforeEach(() => RateLimiter.useMemoryStore())
afterEach(() => RateLimiter.useMemoryStore())

test.each([4, 5, 8, 32])('counts a first simultaneous batch of %i failures', async (count) => {
  const key = 'concurrent@example.invalid'
  await Promise.all(Array.from({ length: count }, () => RateLimiter.recordFailedAttempt(key)))
  expect(await RateLimiter.isRateLimited(key)).toBe(count >= 5)
})

test('counts a warmed batch and differently cased identifiers', async () => {
  await RateLimiter.recordFailedAttempt('Case@Example.invalid')
  await Promise.all(['CASE@example.invalid', 'case@EXAMPLE.invalid', 'Case@Example.invalid', 'case@example.invalid']
    .map(key => RateLimiter.recordFailedAttempt(key)))
  expect(await RateLimiter.isRateLimited('case@example.invalid')).toBe(true)
})

test('keeps independently scheduled keys and reset semantics', async () => {
  await Promise.all([
    ...Array.from({ length: 5 }, () => RateLimiter.recordFailedAttempt('login@example.invalid')),
    ...Array.from({ length: 4 }, () => RateLimiter.recordFailedAttempt('2fa:login@example.invalid')),
  ])
  expect(await RateLimiter.isRateLimited('login@example.invalid')).toBe(true)
  expect(await RateLimiter.isRateLimited('2fa:login@example.invalid')).toBe(false)
  await RateLimiter.resetAttempts('LOGIN@example.invalid')
  expect(await RateLimiter.isRateLimited('login@example.invalid')).toBe(false)
  await RateLimiter.recordFailedAttempt('2fa:login@example.invalid')
  expect(await RateLimiter.isRateLimited('2fa:login@example.invalid')).toBe(true)
})

test('expires a concurrent lockout at its deadline and starts a fresh count', async () => {
  const originalNow = Date.now
  let now = 1_900_000_000_000
  Date.now = () => now
  try {
    RateLimiter.useMemoryStore()
    await Promise.all(Array.from({ length: 5 }, () => RateLimiter.recordFailedAttempt('expiry@example.invalid')))
    expect(await RateLimiter.isRateLimited('expiry@example.invalid')).toBe(true)
    now += 15 * 60 * 1000
    expect(await RateLimiter.isRateLimited('expiry@example.invalid')).toBe(false)
    await Promise.all(Array.from({ length: 4 }, () => RateLimiter.recordFailedAttempt('expiry@example.invalid')))
    expect(await RateLimiter.isRateLimited('expiry@example.invalid')).toBe(false)
    await RateLimiter.recordFailedAttempt('expiry@example.invalid')
    expect(await RateLimiter.isRateLimited('expiry@example.invalid')).toBe(true)
  }
  finally { Date.now = originalNow }
})

test('preserves sequential custom-store calls, normalized keys and TTL', async () => {
  const entries = new Map<string, { attempts: number, lockedUntil: number }>()
  const writes: Array<{ key: string, ttl: number }> = []
  RateLimiter.useStore({
    async get(key) { return entries.get(key) },
    async set(key, entry, ttl) {
      entries.set(key, { ...entry })
      writes.push({ key, ttl })
    },
    async delete(key) { entries.delete(key) },
  })
  for (let i = 0; i < 5; i++) await RateLimiter.recordFailedAttempt('Custom@Example.invalid')
  expect(await RateLimiter.isRateLimited('custom@example.invalid')).toBe(true)
  expect(writes).toEqual(Array.from({ length: 5 }, () => ({ key: 'custom@example.invalid', ttl: 900_000 })))
  await RateLimiter.resetAttempts('CUSTOM@example.invalid')
  expect(await RateLimiter.isRateLimited('custom@example.invalid')).toBe(false)
})

test.each(['get', 'set'] as const)('propagates a custom-store %s failure', async (method) => {
  const failure = new Error(`fixture ${method} failure`)
  RateLimiter.useStore({
    async get() { if (method === 'get') throw failure; return undefined },
    async set() { if (method === 'set') throw failure },
    async delete() {},
  })
  await expect(RateLimiter.recordFailedAttempt('failure@example.invalid')).rejects.toBe(failure)
})
