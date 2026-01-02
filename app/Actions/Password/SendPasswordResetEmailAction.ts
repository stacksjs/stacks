import type { PasswordResetsRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { RateLimiter } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'
import { job } from '@stacksjs/queue'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SendPasswordResetEmailAction',
  description: 'Send Password Reset Email',
  method: 'POST',
  model: 'PasswordResets',
  async handle(request: PasswordResetsRequestType) {
    console.log('[Action] SendPasswordResetEmailAction.handle() called')

    const email = request.get('email')
    console.log('[Action] Email from request:', email)

    if (!email) {
      console.log('[Action] No email provided, returning 422')
      return response.error('Email is required', 422)
    }

    // Rate limit password reset requests by email
    const rateLimitKey = `password_reset:${email.toLowerCase()}`
    if (RateLimiter.isRateLimited(rateLimitKey)) {
      console.log('[Action] Rate limited for:', rateLimitKey)
      return response.error('Too many password reset attempts. Please try again later.', 429)
    }

    // Record the attempt
    RateLimiter.recordFailedAttempt(rateLimitKey)
    console.log('[Action] Recorded rate limit attempt')

    // Check if user exists
    console.log('[Action] Looking up user by email...')
    const user = await User.where('email', email).first()

    if (!user) {
      console.log('[Action] User not found for email:', email)
      return response.error('No account found with this email address.', 404)
    }
    console.log('[Action] User found:', user.id)

    // Dispatch password reset email job to queue (with 10 second delay)
    console.log('[Action] About to dispatch SendPasswordResetEmailJob with 10s delay...')
    try {
      await job('SendPasswordResetEmailJob', { email })
        .onQueue('emails')
        .delay(10)
        .dispatch()
      console.log('[Action] Job dispatched successfully with 10s delay!')
    }
    catch (error) {
      console.error('[Action] Failed to dispatch email job for', email)
      console.error('[Action] Error:', error)
      return response.error('Failed to send password reset email. Please try again later.', 500)
    }

    console.log('[Action] Returning success response')
    return response.success('Password reset link has been sent to your email.')
  },
})
