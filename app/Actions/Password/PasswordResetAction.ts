import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { passwordResets, RateLimiter } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PasswordResetAction',
  description: 'Password Reset',
  method: 'POST',
  model: 'PasswordResets',
  async handle(request: RequestInstance) {
    const token = request.get('token')
    const password = request.get('password')
    const passwordConfirmation = request.get('password_confirmation')
    const email = request.get('email')

    // Validate required fields
    if (!token || !password || !email) {
      return response.error('Missing required fields', 422)
    }

    // Validate password confirmation
    if (password !== passwordConfirmation) {
      return response.error('Password confirmation does not match', 422)
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return response.error('Password must be at least 8 characters', 422)
    }

    // Rate limit password reset attempts by email
    const rateLimitKey = `password_reset_attempt:${email.toLowerCase()}`
    if (RateLimiter.isRateLimited(rateLimitKey)) {
      return response.error('Too many password reset attempts. Please try again later.', 429)
    }

    // Attempt to reset the password
    // This handles user existence check internally and returns a detailed result
    const result = await passwordResets(email).resetPassword(token, password)

    if (!result.success) {
      // Record failed attempt for rate limiting
      RateLimiter.recordFailedAttempt(rateLimitKey)

      // Return appropriate error message without leaking user existence
      // Both "user not found" and "invalid token" return the same generic message
      return response.error(result.message || 'Invalid or expired reset token', 400)
    }

    // Clear rate limit on successful reset
    RateLimiter.resetAttempts(rateLimitKey)

    return response.success('Password has been reset successfully')
  },
})
