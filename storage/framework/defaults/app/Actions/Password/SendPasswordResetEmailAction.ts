import { Action } from '@stacksjs/actions'
import { RateLimiter } from '@stacksjs/auth'
import { log } from '@stacksjs/logging'
import { User } from '@stacksjs/orm'
import { job } from '@stacksjs/queue'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

/**
 * The one thing this endpoint ever says.
 *
 * Held in a constant because the security property is that EVERY path returns
 * it byte for byte — unknown address, known address, and a mail dispatch that
 * blew up. The moment one branch returns something else, the endpoint becomes
 * an account-existence oracle again (stacksjs/stacks#2214).
 */
const NEUTRAL_RESPONSE = 'If an account exists for that email address, a password reset link has been sent.'

export default new Action({
  name: 'SendPasswordResetEmailAction',
  description: 'Send Password Reset Email',
  method: 'POST',
  validations: {
    email: {
      rule: schema.string().email().required(),
    },
  },
  async handle(request) {
    const email = request.get('email')

    if (!email)
      return response.error('Email is required', 422)

    // Rate limiting is per-email, so it does not slow enumeration ACROSS
    // addresses at all — the shape of the attack this endpoint invites. It
    // stays because it still limits hammering one mailbox, but it is not the
    // control that protects existence; the uniform response below is.
    const rateLimitKey = `password_reset:${email.toLowerCase()}`
    if (await RateLimiter.isRateLimited(rateLimitKey))
      return response.error('Too many password reset attempts. Please try again later.', 429)

    await RateLimiter.recordFailedAttempt(rateLimitKey)

    const user = await User.where('email', email).first()

    // No early return for a missing user. It used to answer
    // `404 "No account found with this email address."`, which let anyone test
    // an arbitrary list of addresses for membership against an unauthenticated
    // endpoint. The sibling `PasswordResetAction` already refuses to leak the
    // same fact, so this was an inconsistency between two files in one
    // directory rather than a disagreement about the threat.
    if (user) {
      try {
        await job('SendPasswordResetEmailJob', { email })
          .onQueue('emails')
          .dispatch()
      }
      catch (error) {
        // Swallowed DELIBERATELY, and this is the subtle half. Returning a 500
        // here would reintroduce the oracle whenever the mailer is degraded:
        // an unknown address never reaches dispatch, so it can never 5xx, and
        // "neutral message vs. send failure" becomes the tell. The operator
        // gets the failure in the logs; the caller gets what everyone gets.
        log.error('[password-reset] failed to dispatch reset email', error)
      }
    }

    return response.success(NEUTRAL_RESPONSE)
  },
})
