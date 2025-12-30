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
    const rateLimitKey = `password_reset:${email.toLowerCase()}`
    if (RateLimiter.isRateLimited(rateLimitKey)) {
      return response.error('Too many password reset attempts. Please try again later.', 429)
    }

    // Record the attempt
    RateLimiter.recordFailedAttempt(rateLimitKey)

    // Check if user exists
    const user = await User.where('email', email).first()

    if (!user) {
      return response.error('No account found with this email address.', 404)
    }

    // Send password reset email
    try {
      await passwordResets(email).sendEmail()
    }
    catch (error) {
      console.error(`[PasswordReset] Failed to send email to ${email}`, error)
      return response.error('Failed to send password reset email. Please try again later.', 500)
    }

    return response.success('Password reset link has been sent to your email.')
  },
})
