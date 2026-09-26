import { Action } from '@stacksjs/actions'
import { isBillable } from '@stacksjs/orm'
import { BILLING_NOT_ENABLED } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CreateSubscriptionAction',
  description: 'Create Subscription for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const type = request.get('type') as string
    const plan = request.get('plan') as string
    const period = request.get('period') as string
    const description = request.get('description') as string

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    if (!isBillable(user))
      return response.error(BILLING_NOT_ENABLED, 503)

    // `plan` is the subscription's name ('pro') and `type` the price lookup key
    // ('stacks_pro_monthly'), which is the order `newSubscription` takes them in.
    const { paymentIntent } = await user.newSubscription(plan, type, { description, metadata: { period } })

    return response.json(paymentIntent)
  },
})
