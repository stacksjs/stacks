import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchPaymentCustomerAction',
  description: 'Fetch the payment customer',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // `asStripeUser()` does not exist; `retrieveStripeUser()` is the lookup,
    // and answers undefined for a user with no Stripe customer yet.
    const customer = await user.retrieveStripeUser()

    return response.json(customer)
  },
})
