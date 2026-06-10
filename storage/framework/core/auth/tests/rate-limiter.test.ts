import { beforeEach, describe, expect, it } from 'bun:test'
import { HttpError } from '@stacksjs/error-handling'
import { RateLimiter } from '../src/rate-limiter'

/**
 * Helper: record N failed attempts for a given email
 */
async function recordAttempts(email: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await RateLimiter.recordFailedAttempt(email)
  }
}

describe('RateLimiter', () => {
  beforeEach(async () => {
    // The limiter API is async + pluggable; ensure the process-local store
    // is active and clear any leftover state between tests.
    RateLimiter.useMemoryStore()
    await RateLimiter.resetAttempts('test@example.com')
    await RateLimiter.resetAttempts('user@example.com')
    await RateLimiter.resetAttempts('other@example.com')
    await RateLimiter.resetAttempts('alice@example.com')
    await RateLimiter.resetAttempts('bob@example.com')
    await RateLimiter.resetAttempts('UPPER@EXAMPLE.COM')
    await RateLimiter.resetAttempts('mixed@example.com')
  })

  // --- isRateLimited ---

  it('should not rate-limit a brand-new identifier', async () => {
    expect(await RateLimiter.isRateLimited('new-user@example.com')).toBe(false)
    await RateLimiter.resetAttempts('new-user@example.com')
  })

  it('should not rate-limit after fewer than MAX_ATTEMPTS failures', async () => {
    await recordAttempts('test@example.com', 4) // one below the threshold
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  it('should rate-limit after exactly MAX_ATTEMPTS (5) failures', async () => {
    await recordAttempts('test@example.com', 5)
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(true)
  })

  it('should rate-limit after more than MAX_ATTEMPTS failures', async () => {
    await recordAttempts('test@example.com', 7)
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(true)
  })

  // --- recordFailedAttempt ---

  it('should increment attempt counter on each failed attempt', async () => {
    // 1 attempt -> not locked
    await RateLimiter.recordFailedAttempt('test@example.com')
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(false)

    // 3 more -> still not locked (total 4)
    await recordAttempts('test@example.com', 3)
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(false)

    // 5th attempt triggers lockout
    await RateLimiter.recordFailedAttempt('test@example.com')
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(true)
  })

  it('should reset the attempt counter to 0 when lockout is triggered', async () => {
    // The source resets attempts to 0 once lockout fires, so after
    // the lockout expires the user starts fresh (no residual count).
    await recordAttempts('test@example.com', 5)
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(true)

    // Simulate lockout expiry by manipulating time
    const originalNow = Date.now
    Date.now = () => originalNow() + 15 * 60 * 1000 + 1 // 15 min + 1 ms
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(false)
    Date.now = originalNow
  })

  // --- lockout duration ---

  it('should remain locked during the 15-minute lockout window', async () => {
    const originalNow = Date.now
    const baseTime = originalNow()

    await recordAttempts('test@example.com', 5)

    // 10 minutes later -> still locked
    Date.now = () => baseTime + 10 * 60 * 1000
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(true)
    Date.now = originalNow
  })

  it('should unlock after the lockout duration expires', async () => {
    const originalNow = Date.now
    const baseTime = originalNow()

    await recordAttempts('test@example.com', 5)
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(true)

    // Jump past the 15-minute window
    Date.now = () => baseTime + 15 * 60 * 1000 + 1
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(false)
    Date.now = originalNow
  })

  // --- resetAttempts / clearAttempts ---

  it('should fully reset attempts via resetAttempts', async () => {
    await recordAttempts('test@example.com', 4)
    await RateLimiter.resetAttempts('test@example.com')

    // After reset, even one more attempt should NOT lock (counter was cleared)
    await RateLimiter.recordFailedAttempt('test@example.com')
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  it('should clear an active lockout via resetAttempts', async () => {
    await recordAttempts('test@example.com', 5)
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(true)

    await RateLimiter.resetAttempts('test@example.com')
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  // --- case-insensitive identifiers ---

  it('should treat identifiers as case-insensitive', async () => {
    await recordAttempts('User@Example.COM', 3)
    await RateLimiter.recordFailedAttempt('user@example.com')
    await RateLimiter.recordFailedAttempt('USER@EXAMPLE.COM')
    // Total 5 attempts, all mapped to the same lowercase key
    expect(await RateLimiter.isRateLimited('user@example.com')).toBe(true)
    await RateLimiter.resetAttempts('user@example.com')
  })

  it('should reset with a differently-cased identifier', async () => {
    await recordAttempts('test@example.com', 5)
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(true)

    await RateLimiter.resetAttempts('TEST@EXAMPLE.COM')
    expect(await RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  // --- multiple identifiers tracked independently ---

  it('should track different identifiers independently', async () => {
    await recordAttempts('alice@example.com', 5)
    expect(await RateLimiter.isRateLimited('alice@example.com')).toBe(true)
    expect(await RateLimiter.isRateLimited('bob@example.com')).toBe(false)
  })

  it('should not cross-contaminate counters between identifiers', async () => {
    await recordAttempts('alice@example.com', 3)
    await recordAttempts('bob@example.com', 2)

    // Neither should be locked
    expect(await RateLimiter.isRateLimited('alice@example.com')).toBe(false)
    expect(await RateLimiter.isRateLimited('bob@example.com')).toBe(false)

    // Two more for alice -> locked; bob still fine
    await recordAttempts('alice@example.com', 2)
    expect(await RateLimiter.isRateLimited('alice@example.com')).toBe(true)
    expect(await RateLimiter.isRateLimited('bob@example.com')).toBe(false)
  })

  // --- validateAttempt ---

  it('should not throw for a non-rate-limited user', async () => {
    await expect(RateLimiter.validateAttempt('test@example.com')).resolves.toBeUndefined()
  })

  it('should throw HttpError 429 for a rate-limited user', async () => {
    await recordAttempts('test@example.com', 5)
    await expect(RateLimiter.validateAttempt('test@example.com')).rejects.toThrow()

    try {
      await RateLimiter.validateAttempt('test@example.com')
    }
    catch (err: any) {
      expect(err).toBeInstanceOf(HttpError)
      expect(err.status).toBe(429)
      expect(err.message).toContain('Too many login attempts')
    }
  })
})
