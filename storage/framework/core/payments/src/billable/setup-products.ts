import { saas } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { stripe } from '@stacksjs/payments'

export async function createStripeProduct(): Promise<any> {
  const plans = saas.plans
  try {
    if (plans !== undefined && plans.length) {
      for (const plan of plans) {
        // First, create the product in Stripe
        const product = await stripe.product.create({
          name: plan.productName,
          description: plan.description,
          metadata: plan.metadata,
        })

        // Use the created product's ID to add the pricing options
        for (const pricing of plan.pricing) {
          await stripe.price.create({
            unit_amount: pricing.price,
            currency: pricing.currency,
            recurring: {
              interval: pricing.interval,
            },
            product: product.id,
            nickname: pricing.key, // Optional: adds a nickname for easier reference
          })
        }
      }
    }
  }
  catch (err: any) {
    log.error(err)
  }
}
