import type { UserModel } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED, manageSubscription, PaymentUnsupportedError, summarizeSubscription } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { forBrowser, paymentFailure } from './payment-response'

export default new Action({
  name: 'CreateInvoiceSubscription',
  description: 'Create Invoice Subscription for Stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    const type = request.get('type')
    const plan = request.get('plan')
    if (typeof type !== 'string' || !type || typeof plan !== 'string' || !plan)
      return response.json({ message: 'An invoiced subscription needs a `plan` (its name) and a `type` (the price lookup key).' }, 422)

    // An invoiced subscription is an ordinary one that Stripe bills by emailing
    // an invoice instead of charging a card - a Stripe Billing feature. It used
    // to subscribe everyone to a hard-coded 'pro' / 'stacks_pro_monthly'.
    try {
      const driver = String((config as { payment?: { driver?: string } }).payment?.driver ?? 'stripe')
      if (driver !== 'stripe')
        throw new PaymentUnsupportedError(driver, 'invoiced subscriptions', 'they are a Stripe Billing feature')

      // `request.user()` is the User model instance, which is what the
      // billable modules take; its request-facing type omits the model's own methods.
      const subscription = await manageSubscription.create(user as unknown as UserModel, plan, type, {
        collection_method: 'send_invoice',
        days_until_due: 30,
      })
      return response.json(forBrowser(summarizeSubscription(subscription)))
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
