import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreateInvoiceSubscription',
  description: 'Create Invoice Subscription for Stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))

    const user = await User.find(userId)

    const subscription = await user?.newSubscriptionInvoice('pro', 'stacks_pro_monthly')

    return subscription
  },
})
