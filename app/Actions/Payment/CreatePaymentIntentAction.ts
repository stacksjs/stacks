import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { stripe } from '@stacksjs/payments'

export default new Action({
  name: 'CreatePaymentIntentAction',
  description: 'Create Payment Intent for stripe',
  method: 'POST',
  async handle(request: RequestInstance) {
    const amount = Number(request.get('amount'))

    const paymentIntent = await stripe.paymentIntent.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
    })

    return paymentIntent
  },
})
