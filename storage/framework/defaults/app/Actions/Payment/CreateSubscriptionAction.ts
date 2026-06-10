import { Action } from '@stacksjs/actions'
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

    const subscription = await user?.newSubscription(plan, type, { description, metadata: { period } })

    return response.json(subscription?.paymentIntent)
  },
})
