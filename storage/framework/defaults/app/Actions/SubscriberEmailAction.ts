import { Action } from '@stacksjs/actions/runtime'
import { emailAddress, NewsletterListUnavailableError, subscribe } from '@stacksjs/newsletter'
import { SubscriberEmail } from '@stacksjs/orm'
import { rateLimit } from '@stacksjs/router'
import { sendSubscriptionConfirmRequest } from '../Mail/SubscriptionConfirmRequest'
import { sendSubscriptionConfirmation } from '../Mail/SubscriptionConfirmation'
import { formReturnLocation, wantsFormRedirect } from './form-return'

/**
 * The public newsletter signup, `POST /api/email/subscribe`, behind every
 * `<SubscribeForm>` and any hand-written form.
 *
 * It goes through `@stacksjs/newsletter`'s `subscribe()`, so a signup joins a
 * list (the default list, or a public one the form names in `list`) and
 * campaigns reach it. It used to write only a `subscribers` row and join no
 * list at all, so nobody who signed up on a website ever got a campaign.
 *
 * Fields: `email`, `source` (where they signed up, stored on the row), `list`
 * (a public list's slug; private lists are refused), `return` (where a plain
 * form post comes back to).
 *
 * What a signup came to. A plain form gets it back as `?subscribe=<outcome>`;
 * a script gets the JSON beside it.
 *
 * - `subscribed`: a new address, or one that had unsubscribed and came back.
 * - `pending`: the list has double opt-in on; a confirmation email went out
 *   and the address joins once its link is opened (ConfirmSubscriptionAction).
 * - `already`: the address is on the list.
 * - `invalid`: not an email address.
 * - `busy`: too many attempts from this visitor in a minute.
 * - `error`: anything else. Logged here; the visitor is asked to try again.
 */
type Outcome = 'subscribed' | 'pending' | 'already' | 'invalid' | 'busy' | 'error'

/**
 * The tables this action writes, most of them through @stacksjs/newsletter
 * rather than by model name. Stated here because frameworkRouteAdmission
 * decides from this file's own source whether the route can be mounted: in an
 * app without these tables the route is withheld instead of failing per
 * request.
 */
export const subscriberTables = ['subscribers', 'email_lists', 'email_list_subscribers', 'subscriber_emails'] as const

export default new Action({
  name: 'SubscriberEmailAction',
  description: 'Subscribe an address to a newsletter list and send the welcome email',
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

    const email = emailAddress(request.get('email'))
    const source = String(request.get('source') || 'homepage').slice(0, 100)
    const list = String(request.get('list') || '').trim() || undefined

    if (!email)
      return answer('invalid', { success: false, message: 'A valid email is required' })

    try {
      // `confirmation: 'list'`: a list with double opt-in on holds the address
      // as pending until it confirms; any other list subscribes it at once.
      const result = await subscribe(email, { list, source, publicOnly: true, confirmation: 'list' })

      if (result.pending) {
        // New, returning, or asking again while still pending: (re)send the
        // confirmation email. The rate limit above bounds how often.
        if (result.created || result.reactivated)
          await SubscriberEmail.create({ email, source, subscriber_id: result.subscriberId })
        confirmRequest(email, result.token)
        return answer('pending', { success: true, pending: true, message: 'Confirmation required' })
      }

      if (!result.created && !result.reactivated)
        return answer('already', { success: true, message: 'Already subscribed' })

      // The signup log, tied to the person it belongs to.
      await SubscriberEmail.create({ email, source, subscriber_id: result.subscriberId })

      welcome(email, result.token)

      return answer('subscribed', {
        success: true,
        message: result.reactivated ? 'Subscribed again' : 'Subscribed',
        subscriber: { email, listId: result.listId },
      })
    }
    catch (err) {
      // A form naming a list that is missing or private: say so plainly, as
      // a 422, rather than a 500 carrying the internal error's name.
      if (err instanceof NewsletterListUnavailableError) {
        console.error('[subscribe] signup refused:', err.message)
        return backToForm
          ? answer('error', {})
          : response.json({ success: false, error: 'list_unavailable', message: 'That list is not open for signups.' }, 422)
      }

      if (!backToForm)
        throw err

      console.error('[subscribe] signup failed:', err instanceof Error ? err.message : String(err))
      return answer('error', {})
    }
  },
})

/** Send the double opt-in email without holding up the response; a failure is logged. */
function confirmRequest(to: string, token: string): void {
  sendSubscriptionConfirmRequest({ to, token }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to send the confirmation request to ${to}:`, message)
  })
}

/**
 * Send the welcome email without holding up the response; a failure is
 * logged. `token` is the list membership's own, so the unsubscribe link in
 * the email leaves that list and nothing else.
 */
function welcome(to: string, token: string): void {
  sendSubscriptionConfirmation({ to, token }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Failed to send confirmation email to ${to}:`, message)
  })
}
