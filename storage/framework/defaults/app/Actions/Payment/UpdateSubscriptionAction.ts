import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'UpdateSubscriptionAction',
  description: 'Update Subscription for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const type = request.get('type') as string
    const plan = request.get('plan') as string
    const description = request.get('description') as string

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    const { paymentIntent } = await user.updateSubscription(plan, type, { description })

    return response.json(paymentIntent)
  },
})
