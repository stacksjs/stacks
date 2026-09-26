import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

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

    // There is no `newSubscriptionInvoice` on a billable user, and never was, so
    // this threw "is not a function". An invoiced subscription is an ordinary
    // one that Stripe bills by emailing an invoice instead of charging a card.
    const subscription = await user.newSubscription('pro', 'stacks_pro_monthly', {
      collection_method: 'send_invoice',
      days_until_due: 30,
    })

    return response.json(subscription)
  },
})
