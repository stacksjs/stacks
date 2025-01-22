import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'UpdateSubscriptionAction',
  description: 'Update Subscription for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const type = request.get('type') as string
    const plan = request.get('plan') as string
    const description = request.get('description') as string

    const userId = Number(request.getParam('id'))
    const user = await User.find(userId)

    const subscription = await user?.updateSubscription(plan, type, { description })

    return response.json(subscription?.paymentIntent)
  },
})
