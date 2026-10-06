import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { forBrowser, paymentFailure } from './payment-response'

export default new Action({
  name: 'CreateSubscriptionAction',
  description: 'Create Subscription for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const type = request.get('type')
    const plan = request.get('plan')
    if (typeof type !== 'string' || !type || typeof plan !== 'string' || !plan)
      return response.json({ message: 'A subscription needs a `plan` (its name) and a `type` (the price lookup key).' }, 422)

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // `plan` is the subscription's name ('pro') and `type` the price lookup key
    // ('stacks_pro_monthly'), which is the order `newSubscription` takes them in.
    // An incomplete subscription carries a `clientConfirmation` for its first
    // payment, which the browser confirms.
    try {
      return response.json(forBrowser(await user.newSubscription(plan, type)))
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
