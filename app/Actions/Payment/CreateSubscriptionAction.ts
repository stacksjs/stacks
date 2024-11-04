import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreateSubscriptionAction',
  description: 'Create Subscription for stripe',
  method: 'POST',
  async handle() {
    const user = await User.find(1)

    const subscription = await user?.newSubscription('stacks_pro_yearly', {
      allowPromotions: true, // Example option for allowing promotions
    })

    return subscription
  },
})
