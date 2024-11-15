import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreatePaymentIntentAction',
  description: 'Create Payment Intent for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const amount = Number(request.get('amount'))

    const user = await User.find(2)

    const paymentIntent = await user?.paymentIntent({
      amount,
      currency: 'usd',
      description: 'Subscription to Stacks Pro',
      payment_method_types: ['card'],
    })

    return paymentIntent
  },
})
