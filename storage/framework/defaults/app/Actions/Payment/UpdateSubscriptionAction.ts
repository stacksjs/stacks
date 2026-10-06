import { Action } from '@stacksjs/actions/runtime'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'
import { forBrowser, paymentFailure } from './payment-response'

export default new Action({
  name: 'UpdateSubscriptionAction',
  description: 'Update Subscription for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const type = request.get('type')
    const plan = request.get('plan')
    if (typeof type !== 'string' || !type || typeof plan !== 'string' || !plan)
      return response.json({ message: 'A subscription change needs a `plan` and a `type` (the new price lookup key).' }, 422)

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    try {
      return response.json(forBrowser(await user.updateSubscription(plan, type)))
    }
    catch (error) {
      return paymentFailure(error)
    }
  },
})
