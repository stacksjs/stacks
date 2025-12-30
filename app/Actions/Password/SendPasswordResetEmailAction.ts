import type { PasswordResetsRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { passwordResets, RateLimiter } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SendPasswordResetEmailAction',
  description: 'Send Password Reset Email',
  method: 'POST',
  model: 'PasswordResets',
  async handle(request: PasswordResetsRequestType) {
    const email = request.get('email')

    if (!email) {
      return response.error('Email is required', 422)
    }

    // Rate limit password reset requests by email
    // This prevents abuse while not leaking user existence
    const rateLimitKey = `password_reset:${email.toLowerCase()}`
    if (RateLimiter.isRateLimited(rateLimitKey)) {
      // Still return success to not leak whether user exists
      return response.success('If that email address is in our system, we have sent a password reset link.')
    }

    // Record the attempt regardless of whether user exists
    RateLimiter.recordFailedAttempt(rateLimitKey)

    // Check if user exists, but don't reveal this to the client
    const user = await User.where('email', email).first()

    if (user) {
      // Only send email if user exists
      try {
        await passwordResets(email).sendEmail()
      }
      catch {
        // Log error internally but don't expose to user
        console.error(`[PasswordReset] Failed to send email to ${email}`)
      }
    }

    // Always return the same response regardless of whether user exists
    // This prevents user enumeration attacks
    return response.success('If that email address is in our system, we have sent a password reset link.')
  },
})
