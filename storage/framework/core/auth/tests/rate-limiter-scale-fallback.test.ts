import type { RateLimiterStore } from '../src/rate-limiter'
import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import process from 'node:process'
import { FallbackRateLimiterStore, maxFailedAttempts, RateLimiter } from '../src/rate-limiter'

/**
 * The login lockout follows config.security.rateLimit.scale (so a test suite
 * need not turn it off), and a shared store that errors degrades to this
 * process's memory instead of failing every sign-in.
 */

afterEach(() => {
  delete process.env.STACKS_RATE_LIMIT_SCALE
  RateLimiter.useMemoryStore()
})

describe('the lockout threshold', () => {
  it('is 5 by default and scales', () => {
    expect(maxFailedAttempts()).toBe(5)
    process.env.STACKS_RATE_LIMIT_SCALE = '4'
    expect(maxFailedAttempts()).toBe(20)
  })

  it('locks after the scaled number of failures', async () => {
    process.env.STACKS_RATE_LIMIT_SCALE = '2'
    RateLimiter.useMemoryStore()
    const email = `scale-${crypto.randomUUID()}@example.invalid`
    for (let i = 0; i < 9; i++)
      await RateLimiter.recordFailedAttempt(email)
    expect(await RateLimiter.isRateLimited(email)).toBe(false)
    await RateLimiter.recordFailedAttempt(email)
    expect(await RateLimiter.isRateLimited(email)).toBe(true)
  })
})

describe('FallbackRateLimiterStore', () => {
  it('counts in memory while the shared store is down, and warns once', async () => {
    const down: RateLimiterStore = {
      get: () => { throw new Error('ECONNREFUSED') },
      delete: () => { throw new Error('ECONNREFUSED') },
      recordFailedAttempt: () => { throw new Error('ECONNREFUSED') },
    }
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      RateLimiter.useStore(new FallbackRateLimiterStore(down))
      const email = `fallback-${crypto.randomUUID()}@example.invalid`
      for (let i = 0; i < 5; i++)
        await RateLimiter.recordFailedAttempt(email)
      expect(await RateLimiter.isRateLimited(email)).toBe(true)
      await RateLimiter.resetAttempts(email)
      expect(await RateLimiter.isRateLimited(email)).toBe(false)
      expect(warn).toHaveBeenCalledTimes(1)
    }
    finally {
      warn.mockRestore()
    }
  })

  it('uses the shared store when it answers', async () => {
    const seen: string[] = []
    const shared: RateLimiterStore = {
      get: () => ({ attempts: 0, lockedUntil: Date.now() + 60_000 }),
      delete: (key) => { seen.push(`delete:${key}`) },
      recordFailedAttempt: (key) => { seen.push(`record:${key}`) },
    }
    RateLimiter.useStore(new FallbackRateLimiterStore(shared))
    expect(await RateLimiter.isRateLimited('a@example.invalid')).toBe(true)
    await RateLimiter.recordFailedAttempt('a@example.invalid')
    expect(seen).toEqual(['record:a@example.invalid'])
  })
})
