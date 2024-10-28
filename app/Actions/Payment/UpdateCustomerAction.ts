import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'UpdateCustomerAction',
  description: 'Update customer detauls',
  method: 'POST',
  async handle(request: RequestInstance) {
    const amount = Number(request.get('amount'))

    const user = await User.find(1)

    const paymentIntent = await user?.paymentIntent({
      amount,
      currency: 'usd',
      description: 'Subscription to Stacks Pro',
      payment_method_types: ['card'],
    })

    return paymentIntent
  },
})
