import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'FetchActiveSubscriptionAction',
  description: 'Fetch the current active subscription',
  method: 'GET',
  async handle() {
    const user = await User.find(1)

    const subscription = await user?.activeSubscription()

    return subscription
  },
})
