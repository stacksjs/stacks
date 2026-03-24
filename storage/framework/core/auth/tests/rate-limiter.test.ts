import { beforeEach, describe, expect, it } from 'bun:test'
import { HttpError } from '@stacksjs/error-handling'
import { RateLimiter } from '../src/rate-limiter'

/**
 * Helper: record N failed attempts for a given email
 */
function recordAttempts(email: string, count: number): void {
  for (let i = 0; i < count; i++) {
    RateLimiter.recordFailedAttempt(email)
  }
}

describe('RateLimiter', () => {
  beforeEach(() => {
    // Clear any leftover state between tests
    RateLimiter.resetAttempts('test@example.com')
    RateLimiter.resetAttempts('user@example.com')
    RateLimiter.resetAttempts('other@example.com')
    RateLimiter.resetAttempts('alice@example.com')
    RateLimiter.resetAttempts('bob@example.com')
    RateLimiter.resetAttempts('UPPER@EXAMPLE.COM')
    RateLimiter.resetAttempts('mixed@example.com')
  })

  // --- isRateLimited ---

  it('should not rate-limit a brand-new identifier', () => {
    expect(RateLimiter.isRateLimited('new-user@example.com')).toBe(false)
    RateLimiter.resetAttempts('new-user@example.com')
  })

  it('should not rate-limit after fewer than MAX_ATTEMPTS failures', () => {
    recordAttempts('test@example.com', 4) // one below the threshold
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  it('should rate-limit after exactly MAX_ATTEMPTS (5) failures', () => {
    recordAttempts('test@example.com', 5)
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)
  })

  it('should rate-limit after more than MAX_ATTEMPTS failures', () => {
    recordAttempts('test@example.com', 7)
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)
  })

  // --- recordFailedAttempt ---

  it('should increment attempt counter on each failed attempt', () => {
    // 1 attempt -> not locked
    RateLimiter.recordFailedAttempt('test@example.com')
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)

    // 3 more -> still not locked (total 4)
    recordAttempts('test@example.com', 3)
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)

    // 5th attempt triggers lockout
    RateLimiter.recordFailedAttempt('test@example.com')
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)
  })

  it('should reset the attempt counter to 0 when lockout is triggered', () => {
    // The source resets attempts to 0 once lockout fires, so after
    // the lockout expires the user starts fresh (no residual count).
    recordAttempts('test@example.com', 5)
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)

    // Simulate lockout expiry by manipulating time
    const originalNow = Date.now
    Date.now = () => originalNow() + 15 * 60 * 1000 + 1 // 15 min + 1 ms
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
    Date.now = originalNow
  })

  // --- lockout duration ---

  it('should remain locked during the 15-minute lockout window', () => {
    const originalNow = Date.now
    const baseTime = originalNow()

    recordAttempts('test@example.com', 5)

    // 10 minutes later -> still locked
    Date.now = () => baseTime + 10 * 60 * 1000
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)
    Date.now = originalNow
  })

  it('should unlock after the lockout duration expires', () => {
    const originalNow = Date.now
    const baseTime = originalNow()

    recordAttempts('test@example.com', 5)
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)

    // Jump past the 15-minute window
    Date.now = () => baseTime + 15 * 60 * 1000 + 1
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
    Date.now = originalNow
  })

  // --- resetAttempts / clearAttempts ---

  it('should fully reset attempts via resetAttempts', () => {
    recordAttempts('test@example.com', 4)
    RateLimiter.resetAttempts('test@example.com')

    // After reset, even one more attempt should NOT lock (counter was cleared)
    RateLimiter.recordFailedAttempt('test@example.com')
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  it('should clear an active lockout via resetAttempts', () => {
    recordAttempts('test@example.com', 5)
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)

    RateLimiter.resetAttempts('test@example.com')
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  // --- case-insensitive identifiers ---

  it('should treat identifiers as case-insensitive', () => {
    recordAttempts('User@Example.COM', 3)
    RateLimiter.recordFailedAttempt('user@example.com')
    RateLimiter.recordFailedAttempt('USER@EXAMPLE.COM')
    // Total 5 attempts, all mapped to the same lowercase key
    expect(RateLimiter.isRateLimited('user@example.com')).toBe(true)
    RateLimiter.resetAttempts('user@example.com')
  })

  it('should reset with a differently-cased identifier', () => {
    recordAttempts('test@example.com', 5)
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(true)

    RateLimiter.resetAttempts('TEST@EXAMPLE.COM')
    expect(RateLimiter.isRateLimited('test@example.com')).toBe(false)
  })

  // --- multiple identifiers tracked independently ---

  it('should track different identifiers independently', () => {
    recordAttempts('alice@example.com', 5)
    expect(RateLimiter.isRateLimited('alice@example.com')).toBe(true)
    expect(RateLimiter.isRateLimited('bob@example.com')).toBe(false)
  })

  it('should not cross-contaminate counters between identifiers', () => {
    recordAttempts('alice@example.com', 3)
    recordAttempts('bob@example.com', 2)

    // Neither should be locked
    expect(RateLimiter.isRateLimited('alice@example.com')).toBe(false)
    expect(RateLimiter.isRateLimited('bob@example.com')).toBe(false)

    // Two more for alice -> locked; bob still fine
    recordAttempts('alice@example.com', 2)
    expect(RateLimiter.isRateLimited('alice@example.com')).toBe(true)
    expect(RateLimiter.isRateLimited('bob@example.com')).toBe(false)
  })

  // --- validateAttempt ---

  it('should not throw for a non-rate-limited user', () => {
    expect(() => RateLimiter.validateAttempt('test@example.com')).not.toThrow()
  })

  it('should throw HttpError 429 for a rate-limited user', () => {
    recordAttempts('test@example.com', 5)
    expect(() => RateLimiter.validateAttempt('test@example.com')).toThrow()

    try {
      RateLimiter.validateAttempt('test@example.com')
    }
    catch (err: any) {
      expect(err).toBeInstanceOf(HttpError)
      expect(err.status).toBe(429)
      expect(err.message).toContain('Too many login attempts')
    }
  })
})
