import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'CreateSubscriptionAction',
  description: 'Create Subscription for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))

    const type = request.get('type') as string
    const plan = request.get('plan') as string
    const period = request.get('period') as string
    const description = request.get('description') as string

    const user = await User.find(userId)

    const subscription = await user?.newSubscription(plan, type, { description, metadata: { period } })

    return response.json(subscription?.paymentIntent)
  },
})
