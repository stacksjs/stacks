import { Action } from '@stacksjs/actions/runtime'
import { isUniqueViolation, Subscriber, SubscriberEmail } from '@stacksjs/orm'
import { rateLimit } from '@stacksjs/router'
import { sendSubscriptionConfirmation } from '../Mail/SubscriptionConfirmation'
import { formReturnLocation, normalizeEmail, wantsFormRedirect } from './form-return'

/**
 * What a signup came to. A plain form gets it back as `?subscribe=<outcome>`;
 * a script gets the JSON beside it.
 *
 * - `subscribed`: a new address, or one that had unsubscribed and came back.
 * - `already`: the address is on the list.
 * - `invalid`: not an email address.
 * - `busy`: too many attempts from this visitor in a minute.
 * - `error`: anything else. Logged here; the visitor is asked to try again.
 */
type Outcome = 'subscribed' | 'already' | 'invalid' | 'busy' | 'error'

export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Save emails from subscribe page and send confirmation email',
  method: 'POST',

  async handle(request: RequestInstance) {
    // A plain <form> post goes back to its page with the outcome in the query
    // string (see ./form-return.ts), so a visitor never lands on raw JSON or
    // an error screen. A script keeps getting JSON, and errors, as before.
    const backToForm = wantsFormRedirect(request.headers)
    const answer = (outcome: Outcome, json: Record<string, unknown>) => backToForm
      ? response.redirect(formReturnLocation({ target: request.get('return'), referer: request.headers.get('referer'), param: 'subscribe', outcome }), 303)
      : json

    try {
      // Per-IP throttle. The endpoint is unauthenticated and skipCsrf'd so
      // bots will find it; without this they can flood the subscribers
      // table within minutes and burn through SES/SendGrid quota. 10/min
      // is generous for a real human filling the same form repeatedly.
      await rateLimit('email-subscribe', 10).per('minute')
    }
    catch (err) {
      if (backToForm && (err as { status?: number })?.status === 429)
        return answer('busy', {})
      throw err
    }

    const email = normalizeEmail(request.get('email'))
    const source = String(request.get('source') || 'homepage').slice(0, 120)

    if (!email)
      return answer('invalid', { success: false, message: 'A valid email is required' })

    try {
      const existing = await Subscriber.where('email', email).first()

      if (existing) {
        if (existing.status !== 'unsubscribed')
          return answer('already', { success: true, message: 'Already subscribed' })

        // They left and came back. Telling them "already subscribed" while
        // the row still says unsubscribed would keep them off every send.
        await existing.update({ status: 'subscribed', unsubscribed_at: null, source })
        await SubscriberEmail.create({ email, source })
        welcome(email, existing.uuid)
        return answer('subscribed', { success: true, message: 'Subscribed' })
      }

      // Create subscriber record. The check above is a fast path; two requests
      // for the same email can still both pass it and race into the
      // subscribers.email unique index (#1957). Treat the loser's unique
      // violation as the same "already subscribed" success — the response
      // contract (and its enumeration semantics) is unchanged.
      let subscriber: any
      try {
        subscriber = await Subscriber.create({ email, status: 'subscribed', source })
      }
      catch (err) {
        if (isUniqueViolation(err))
          return answer('already', { success: true, message: 'Already subscribed' })
        throw err
      }

      // Log the email event
      await SubscriberEmail.create({ email, source })

      welcome(email, subscriber.uuid)

      return answer('subscribed', { success: true, subscriber })
    }
    catch (err) {
      if (!backToForm)
        throw err

      console.error('[subscribe] signup failed:', err instanceof Error ? err.message : String(err))
      return answer('error', {})
    }
  },
})

/** Send the welcome email without holding up the response; a failure is logged. */
function welcome(to: string, subscriberUuid: string): void {
  sendSubscriptionConfirmation({ to, subscriberUuid }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to send confirmation email to ${to}:`, message)
  })
}
