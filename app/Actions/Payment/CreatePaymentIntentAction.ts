import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { stripe } from '@stacksjs/payments'
import User from '../../../storage/framework/orm/src/models/User.ts'

export default new Action({
  name: 'CreatePaymentIntentAction',
  description: 'Create Payment Intent for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const amount = Number(request.get('amount'))

    const user = await User.find(1)

    const customer = await user?.createOrGetStripeUser({ email: user.email, name: 'Glenn Michael Torregosa' })

    const paymentIntent = await stripe.paymentIntent.create({
      customer: customer?.id,
      amount,
      currency: 'usd',
      description: 'Subscription to Stacks Pro',
      payment_method_types: ['card'],
    })

    return paymentIntent
  },
})
