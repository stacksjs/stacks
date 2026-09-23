import { afterEach, beforeEach, expect, setSystemTime, test } from 'bun:test'
import { RateLimiter } from '../src/rate-limiter'

const start = new Date('2030-01-02T03:04:05Z').getTime()
const ttl = 15 * 60 * 1000
const email = 'synthetic-attempt-expiry@example.invalid'
beforeEach(() => {
  setSystemTime(start)
  RateLimiter.useMemoryStore()
})
afterEach(() => {
  setSystemTime()
  RateLimiter.useMemoryStore()
})

test('partial failure counters expire at their store TTL without a prior lockout', async () => {
  for (let i = 0; i < 4; i++) await RateLimiter.recordFailedAttempt(email)
  setSystemTime(start + ttl)
  await RateLimiter.recordFailedAttempt(email)
  expect(await RateLimiter.isRateLimited(email)).toBe(false)
  for (let i = 0; i < 3; i++) await RateLimiter.recordFailedAttempt(email)
  expect(await RateLimiter.isRateLimited(email)).toBe(false)
  await RateLimiter.recordFailedAttempt(email)
  expect(await RateLimiter.isRateLimited(email)).toBe(true)
})

test('partial counters remain effective immediately before their TTL', async () => {
  for (let i = 0; i < 4; i++) await RateLimiter.recordFailedAttempt(email)
  setSystemTime(start + ttl - 1)
  await RateLimiter.recordFailedAttempt(email)
  expect(await RateLimiter.isRateLimited(email)).toBe(true)
})

test('a later failure renews the counter TTL without resetting its attempts', async () => {
  for (let i = 0; i < 3; i++) await RateLimiter.recordFailedAttempt(email)
  setSystemTime(start + ttl - 1000)
  await RateLimiter.recordFailedAttempt(email)
  setSystemTime(start + ttl)
  await RateLimiter.recordFailedAttempt(email)
  expect(await RateLimiter.isRateLimited(email)).toBe(true)
})
