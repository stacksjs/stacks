import { expect, setSystemTime, test } from 'bun:test'
import { RateLimiter } from '../src/rate-limiter'

test('growing live limiter state does not rescan every entry on every attempt', async () => {
  const start = new Date('2030-01-02T03:04:05Z').getTime()
  setSystemTime(start)
  RateLimiter.useMemoryStore()
  const prefix = 'eviction-work-'
  const original = Map.prototype[Symbol.iterator]
  let visits = 0
  // Count work rather than wall time, which depends on machine load. Only
  // count this fixture's limiter entries and restore the iterator in finally.
  Map.prototype[Symbol.iterator] = function* () {
    for (const entry of original.call(this)) {
      if (typeof entry[0] === 'string' && entry[0].startsWith(prefix)
        && entry[1]?.entry && typeof entry[1]?.expiresAt === 'number') visits++
      yield entry
    }
  } as typeof original
  try {
    for (let i = 0; i < 10_020; i++)
      await RateLimiter.recordFailedAttempt(`${prefix}${i}@example.invalid`)
    expect(visits).toBeLessThanOrEqual(20_040)

    // A larger wave may schedule another sweep, but its total work must stay
    // proportional to growth rather than to every request above the threshold.
    for (let i = 10_020; i < 20_040; i++)
      await RateLimiter.recordFailedAttempt(`${prefix}${i}@example.invalid`)
    expect(visits).toBeLessThanOrEqual(60_120)

    const beforeReads = visits
    for (let i = 0; i < 100; i++)
      expect(await RateLimiter.isRateLimited(`${prefix}${i}@example.invalid`)).toBe(false)
    expect(visits).toBe(beforeReads)

    // Reducing cleanup work cannot discard live counters to achieve it.
    for (let i = 0; i < 4; i++)
      await RateLimiter.recordFailedAttempt(`${prefix}0@example.invalid`)
    expect(await RateLimiter.isRateLimited(`${prefix}0@example.invalid`)).toBe(true)

    // Renew one account before the bulk expires. Periodic cleanup must still
    // run after growth has stopped, preserve its lock, and remove stale counts.
    setSystemTime(start + 4 * 60_000)
    for (let i = 0; i < 4; i++)
      await RateLimiter.recordFailedAttempt(`${prefix}1@example.invalid`)
    setSystemTime(start + 15 * 60_000)
    const beforeCleanup = visits
    expect(await RateLimiter.isRateLimited(`${prefix}1@example.invalid`)).toBe(true)
    expect(visits - beforeCleanup).toBe(20_040)
    const afterCleanup = visits
    for (let i = 0; i < 100; i++)
      await RateLimiter.isRateLimited(`${prefix}1@example.invalid`)
    expect(visits).toBe(afterCleanup)
    for (let i = 0; i < 4; i++)
      await RateLimiter.recordFailedAttempt(`${prefix}2@example.invalid`)
    expect(await RateLimiter.isRateLimited(`${prefix}2@example.invalid`)).toBe(false)
    await RateLimiter.recordFailedAttempt(`${prefix}2@example.invalid`)
    expect(await RateLimiter.isRateLimited(`${prefix}2@example.invalid`)).toBe(true)
    setSystemTime(start + 19 * 60_000)
    expect(await RateLimiter.isRateLimited(`${prefix}1@example.invalid`)).toBe(false)
  }
  finally {
    Map.prototype[Symbol.iterator] = original
    setSystemTime()
    RateLimiter.useMemoryStore()
  }
})
