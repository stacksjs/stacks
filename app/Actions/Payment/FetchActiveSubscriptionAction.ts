import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'FetchActiveSubscriptionAction',
  description: 'Fetch the current active subscription',
  method: 'GET',
  async handle() {
    const userId = Number(request.getParam('id'))

    const user = await User.find(userId)

    const subscription = await user?.activeSubscription()

    return subscription
  },
})
