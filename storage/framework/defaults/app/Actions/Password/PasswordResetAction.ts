import { Action } from '@stacksjs/actions'
import { passwordResets, RateLimiter } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE } from '../../password-policy'

export default new Action({
  name: 'PasswordResetAction',
  description: 'Password Reset',
  method: 'POST',

  // Declared rather than hand-checked (#2226). `password.length < 8` inside
  // handle() was invisible to everything that reads `validations:` — the
  // client could not ask for it, and it drifted from the six every other
  // password declaration used. Declaring it also means this endpoint answers a
  // precognition probe, so a reset form can check the field on blur without
  // spending a reset token to find out.
  validations: {
    email: {
      rule: schema.string().required().email(),
      message: 'Email must be a valid email address.',
    },
    token: {
      rule: schema.string().required().min(1),
      message: 'A reset token is required.',
    },
    password: {
      rule: schema.string().required().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
      message: PASSWORD_POLICY_MESSAGE,
    },
  },

  async handle(request) {
    const token = request.get('token')
    const password = request.get('password')
    const passwordConfirmation = request.get('password_confirmation')
    const email = request.get('email')

    // Kept as a floor for direct invocation: `validations:` only runs when this
    // action is reached through the router, and a test or a queued job calling
    // handle() straight would otherwise pass undefined into resetPassword.
    if (!token || !password || !email) {
      return response.error('Missing required fields', 422)
    }

    // Cross-field, so it cannot live in `validations:` — those rules see one
    // field at a time. Length and format are declared up there instead.
    if (password !== passwordConfirmation) {
      return response.error('Password confirmation does not match', 422)
    }

    // Rate limit password reset attempts by email
    const rateLimitKey = `password_reset_attempt:${email.toLowerCase()}`
    if (await RateLimiter.isRateLimited(rateLimitKey)) {
      return response.error('Too many password reset attempts. Please try again later.', 429)
    }

    // Attempt to reset the password
    // This handles user existence check internally and returns a detailed result
    const result = await passwordResets(email).resetPassword(token, password)

    if (!result.success) {
      // Record failed attempt for rate limiting
      await RateLimiter.recordFailedAttempt(rateLimitKey)

      // Return appropriate error message without leaking user existence
      // Both "user not found" and "invalid token" return the same generic message
      return response.error(result.message || 'Invalid or expired reset token', 400)
    }

    // Clear rate limit on successful reset
    await RateLimiter.resetAttempts(rateLimitKey)

    return response.success('Password has been reset successfully')
  },
})
