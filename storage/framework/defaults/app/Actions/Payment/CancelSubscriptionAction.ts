import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CancelSubscriptionAction',
  description: 'Cancel Subscription for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const providerId = request.get('providerId') as string

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const subscription = await user?.cancelSubscription(providerId)

    return response.json(subscription?.paymentIntent)
  },
})
