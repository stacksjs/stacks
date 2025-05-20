import { HttpError } from '@stacksjs/error-handling'

// Rate limiting configuration
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes in milliseconds
const attemptStore = new Map<string, { attempts: number, lockedUntil: number }>()

export class RateLimiter {
  static isRateLimited(email: string): boolean {
    const now = Date.now()
    const userAttempts = attemptStore.get(email)

    if (!userAttempts)
      return false

    if (userAttempts.lockedUntil > now)
      return true

    if (userAttempts.attempts >= MAX_ATTEMPTS) {
      attemptStore.set(email, { attempts: 0, lockedUntil: now + LOCKOUT_DURATION })
      return true
    }

    return false
  }

  static recordFailedAttempt(email: string): void {
    const userAttempts = attemptStore.get(email) || { attempts: 0, lockedUntil: 0 }
    userAttempts.attempts++
    attemptStore.set(email, userAttempts)
  }

  static resetAttempts(email: string): void {
    attemptStore.delete(email)
  }

  static validateAttempt(email: string): void {
    if (this.isRateLimited(email))
      throw new HttpError(429, 'Too many login attempts. Please try again later.')
  }
}
