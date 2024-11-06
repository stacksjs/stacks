import { saas } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { stripe } from '@stacksjs/payments'

export async function createStripeProduct(): Promise<any> {
  const plans = saas.plans
  try {
    if (plans !== undefined && plans.length) {
      for (const plan of plans) {
        for (const pricing of plan.pricing) {
          await stripe.price.create({
            unit_amount: pricing.price,
            currency: pricing.currency,
            recurring: {
              interval: pricing.interval,
            },
            product_data: {
              name: plan.productName,
              metadata: plan.metadata,
            },
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
