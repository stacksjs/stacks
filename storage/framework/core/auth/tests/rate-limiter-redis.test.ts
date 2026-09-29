import { expect, test } from 'bun:test'
import { config } from '@stacksjs/config'
import { RateLimiter, RedisRateLimiterStore } from '../src/rate-limiter'

const redisUrl = process.env.STACKS_TEST_REDIS_URL

test.skipIf(!redisUrl)('Redis rate-limit failures are atomic across worker stores', async () => {
  const prefix = `stacks:test:auth-rate-limit:${process.pid}:${crypto.randomUUID()}`
  const first = new RedisRateLimiterStore({ url: redisUrl, prefix })
  const second = new RedisRateLimiterStore({ url: redisUrl, prefix })
  const key = 'shared@example.invalid'
  const now = Date.now()
  const ttl = 15 * 60 * 1000

  try {
    await Promise.all([
      first.recordFailedAttempt(key, now, ttl),
      second.recordFailedAttempt(key, now, ttl),
      first.recordFailedAttempt(key, now, ttl),
      second.recordFailedAttempt(key, now, ttl),
    ])
    expect(await first.get(key)).toEqual({ attempts: 4, lockedUntil: 0 })

    await second.recordFailedAttempt(key, now, ttl)
    expect(await first.get(key)).toEqual({ attempts: 0, lockedUntil: now + ttl })
    expect(await second.get(key)).toEqual({ attempts: 0, lockedUntil: now + ttl })

    await first.delete(key)
    expect(await second.get(key)).toBeUndefined()
  }
  finally {
    await first.delete(key)
    await Promise.all([first.close(), second.close()])
  }
})

test.skipIf(!redisUrl)('Redis cache configuration selects the shared limiter automatically', async () => {
  const originalDriver = config.cache.driver
  const originalPrefix = config.cache.prefix
  const originalUrl = config.cache.drivers.redis?.url
  const prefix = `stacks:test:configured-auth-rate-limit:${process.pid}:${crypto.randomUUID()}`
  const key = 'configured@example.invalid'

  try {
    config.cache.driver = 'redis'
    config.cache.prefix = prefix
    config.cache.drivers.redis = { ...config.cache.drivers.redis!, url: redisUrl }
    RateLimiter.useConfiguredStore()

    await Promise.all(Array.from({ length: 5 }, () => RateLimiter.recordFailedAttempt(key)))
    expect(await RateLimiter.isRateLimited(key)).toBe(true)
    await RateLimiter.resetAttempts(key)
    expect(await RateLimiter.isRateLimited(key)).toBe(false)
  }
  finally {
    RateLimiter.useMemoryStore()
    config.cache.driver = originalDriver
    config.cache.prefix = originalPrefix
    config.cache.drivers.redis = { ...config.cache.drivers.redis!, url: originalUrl }
  }
})
