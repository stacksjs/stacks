import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreateInvoiceSubscription',
  description: 'Create Invoice Subscription for Stripe',
  method: 'POST',
  async handle() {
    const user = await User.find(1)

    const subscription = await user?.newSubscriptionInvoice('stacks_pro_yearly', {
      allowPromotions: true,
    })

    return subscription
  },
})
