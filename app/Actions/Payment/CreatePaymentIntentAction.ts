import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreatePaymentIntentAction',
  description: 'Create Payment Intent for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const userId = Number(request.getParam('id'))

    const user = await User.find(userId)

    const paymentIntent = await user?.paymentIntent({
      amount: 1000,
      currency: 'usd',
      payment_method_types: ['card'],
    })

    return paymentIntent
  },
})
