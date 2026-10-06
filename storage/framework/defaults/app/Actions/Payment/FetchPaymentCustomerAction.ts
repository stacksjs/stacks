import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { paymentFailure } from './payment-response'

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

    // The provider's customer for this user - created on first use - in our
    // terms, whichever provider is configured.
    try {
      return response.json(await user.paymentCustomer())
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
