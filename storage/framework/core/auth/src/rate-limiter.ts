import { HttpError } from '@stacksjs/error-handling'

// Rate limiting configuration
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds
const MAX_STORE_SIZE = 10_000
const EVICTION_INTERVAL = 5 * 60 * 1000 // Run eviction every 5 minutes
const attemptStore = new Map<string, { attempts: number, lockedUntil: number }>()
let lastEviction = Date.now()

/**
 * Evict stale entries whose lockout has expired and whose attempts
 * have been consumed. This prevents unbounded memory growth.
 */
function evictStaleEntries(): void {
  const now = Date.now()
  if (now - lastEviction < EVICTION_INTERVAL && attemptStore.size < MAX_STORE_SIZE)
    return

  lastEviction = now
  for (const [key, value] of attemptStore) {
    // Remove entries whose lockout has expired
    if (value.lockedUntil > 0 && value.lockedUntil <= now) {
      attemptStore.delete(key)
    }
  }
}

export class RateLimiter {
  static isRateLimited(email: string): boolean {
    email = email.toLowerCase()
    evictStaleEntries()

    const now = Date.now()
    const userAttempts = attemptStore.get(email)

    if (!userAttempts)
      return false

    // If the lockout has expired, clear the entry
    if (userAttempts.lockedUntil > 0 && userAttempts.lockedUntil <= now) {
      attemptStore.delete(email)
      return false
    }

    // Currently locked out
    if (userAttempts.lockedUntil > 0)
      return true

    return false
  }

  static recordFailedAttempt(email: string): void {
    email = email.toLowerCase()
    const now = Date.now()
    const userAttempts = attemptStore.get(email) || { attempts: 0, lockedUntil: 0 }
    userAttempts.attempts++

    // Lock out after reaching max attempts
    if (userAttempts.attempts >= MAX_ATTEMPTS) {
      userAttempts.lockedUntil = now + LOCKOUT_DURATION
      userAttempts.attempts = 0
    }

    attemptStore.set(email, userAttempts)
  }

  static resetAttempts(email: string): void {
    attemptStore.delete(email.toLowerCase())
  }

  static validateAttempt(email: string): void {
    if (this.isRateLimited(email))
      throw new HttpError(429, 'Too many login attempts. Please try again later.')
  }
}
