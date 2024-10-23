import { Action } from '@stacksjs/actions'
import { stripe } from '@stacksjs/payments'

export default new Action({
  name: 'CreateSubscriptionAction',
  description: 'Create Subscription for stripe',
  method: 'POST',
  async handle() {
    const subscription = await stripe.subscription.create({
        customer: 'cus_R5DJaEyyeKKlAN',
        items: [
        {
            price: 'price_1QCjMXBv6MhUdo23Pvb5dwUd',
        },
        ],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
    })
    
    // Step 3: Get the PaymentIntent for the first invoice from the subscription
    const latestInvoice = subscription.latest_invoice
    const paymentIntent = typeof latestInvoice === 'object' ? latestInvoice?.payment_intent : undefined
    
    // Step 4: Pass the client_secret to the front end for Stripe Elements
    return paymentIntent
  },
})
