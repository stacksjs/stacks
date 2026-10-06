import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { forBrowser, paymentFailure } from './payment-response'

export default new Action({
  name: 'FetchActiveSubscriptionAction',
  description: 'Fetch the current active subscription',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    try {
      const active = await user.activeSubscription()
      return response.json(active ? { subscription: active.subscription, providerSubscription: forBrowser(active.providerSubscription) } : null)
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
