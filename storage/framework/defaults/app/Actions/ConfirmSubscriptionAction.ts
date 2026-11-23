import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { confirm } from '@stacksjs/newsletter'
import { sendSubscriptionConfirmation } from '../Mail/SubscriptionConfirmation'
import { subscriptionPage } from './subscription-page'

/**
 * `GET /api/email/confirm?token=…`: the button in the double opt-in email.
 *
 * Confirms the pending list membership the token names (@stacksjs/newsletter's
 * `confirm()`), sends the welcome email the first time, and answers with a
 * small page. Confirming twice is harmless. A token that has since
 * unsubscribed is refused, so an old confirmation link never undoes an
 * opt-out.
 */
export default new Action({
  name: 'ConfirmSubscriptionAction',
  description: 'Confirm a double opt-in newsletter subscription from the emailed link',
  method: 'GET',

  async handle(request: RequestInstance) {
    const token = String(request.get('token') || '')
    const html = (title: string, message: string, success: boolean) => new Response(subscriptionPage(title, message, success), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })

    if (!token)
      return html('Missing token', 'This confirmation link is incomplete. Open it again from the email.', false)

    try {
      const result = await confirm(token)

      if (!result.ok)
        return html('Link no longer valid', 'This confirmation link has expired or was already used to unsubscribe. Sign up again to get a fresh one.', false)

      if (result.alreadyConfirmed)
        return html('Already confirmed', `${result.email ?? 'Your address'} is already subscribed. Nothing else to do.`, true)

      if (result.email) {
        sendSubscriptionConfirmation({ to: result.email, token }).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`Failed to send welcome email to ${result.email}:`, message)
        })
      }

      return html('You are subscribed', `Thanks for confirming. ${result.email ?? 'Your address'} is on the list, and a welcome email is on its way.`, true)
    }
    catch (error: unknown) {
      console.error('Confirm subscription error:', error instanceof Error ? error.message : String(error))
      return html('Something went wrong', 'We could not confirm your subscription just now. Please try the link again in a moment.', false)
    }
  },
})
