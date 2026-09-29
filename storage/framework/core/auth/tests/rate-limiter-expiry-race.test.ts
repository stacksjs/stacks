import type { RateLimitEntry } from '../src/rate-limiter'
import { afterEach, expect, test } from 'bun:test'
import { createMemoryCache } from '@stacksjs/cache'
import { RateLimiter } from '../src/rate-limiter'

afterEach(() => RateLimiter.useMemoryStore())

async function recordCacheFailure(
  cache: ReturnType<typeof createMemoryCache>,
  key: string,
  now: number,
  ttl: number,
): Promise<void> {
  const current = await cache.get<RateLimitEntry>(key)
  const expired = current && current.lockedUntil > 0 && current.lockedUntil <= now
  const attempts = (current && !expired ? current.attempts : 0) + 1
  await cache.set(key, attempts >= 5
    ? { attempts: 0, lockedUntil: now + ttl }
    : { attempts, lockedUntil: current && !expired ? current.lockedUntil : 0 }, ttl / 1000)
}

test('an expired read cannot delete a concurrently renewed lockout', async () => {
  const cache = createMemoryCache({ checkPeriod: 0 })
  const key = 'renewal@example.invalid'
  let holdRead = true
  const readStarted = Promise.withResolvers<void>()
  const releaseRead = Promise.withResolvers<void>()
  try {
    await cache.set(key, { attempts: 0, lockedUntil: Date.now() - 1 })
    RateLimiter.useStore({
      async get(key) {
        const entry = await cache.get<RateLimitEntry>(key)
        if (holdRead) {
          holdRead = false
          readStarted.resolve()
          await releaseRead.promise
        }
        return entry
      },
      recordFailedAttempt: (key, now, ttl) => recordCacheFailure(cache, key, now, ttl),
      async delete(key) { await cache.remove(key) },
    })
    const expiredRead = RateLimiter.isRateLimited(key)
    await readStarted.promise
    for (let i = 0; i < 5; i++) await RateLimiter.recordFailedAttempt(key)
    releaseRead.resolve()
    expect(await expiredRead).toBe(false)
    expect(await RateLimiter.isRateLimited(key)).toBe(true)
    await expect(RateLimiter.validateAttempt(key)).rejects.toThrow('Too many login attempts')
  }
  finally {
    releaseRead.resolve()
    await cache.close()
  }
})

test('recording after expiry starts a fresh count without needing an earlier check', async () => {
  const cache = createMemoryCache({ checkPeriod: 0 })
  const key = 'expired-counter@example.invalid'
  try {
    await cache.set(key, { attempts: 4, lockedUntil: Date.now() - 1 })
    RateLimiter.useStore({
      get: key => cache.get<RateLimitEntry>(key),
      recordFailedAttempt: (key, now, ttl) => recordCacheFailure(cache, key, now, ttl),
      async delete(key) { await cache.remove(key) },
    })
    await RateLimiter.recordFailedAttempt(key)
    expect(await RateLimiter.isRateLimited(key)).toBe(false)
    for (let i = 0; i < 3; i++) await RateLimiter.recordFailedAttempt(key)
    expect(await RateLimiter.isRateLimited(key)).toBe(false)
    await RateLimiter.recordFailedAttempt(key)
    expect(await RateLimiter.isRateLimited(key)).toBe(true)
  }
  finally { await cache.close() }
})
