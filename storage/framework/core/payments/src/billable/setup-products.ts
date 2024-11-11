import { saas } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { stripe } from '@stacksjs/payments'

interface PriceParams {
  unit_amount: number
  currency: string
  product: string
  nickname: string
  recurring?: {
    interval: "day" | "month" | "week" | "year"
  }
}
export async function createStripeProduct(): Promise<void> {
  const plans = saas.plans
  try {
    if (plans !== undefined && plans.length) {
      for (const plan of plans) {
        // First, create the product in Stripe
        const product = await stripe.product.getOrCreate(plan.productName, {
          name: plan.productName,
          description: plan.description,
          metadata: plan.metadata,
        })

        // Use the created product's ID to add the pricing options
        for (const pricing of plan.pricing) {
          const priceParams: PriceParams = {
            unit_amount: pricing.price,
            currency: pricing.currency,
            product: product.id,
            nickname: pricing.key, // Optional: adds a nickname for easier reference
          }

          // Check if 'interval' exists to handle recurring or one-time payment
          if (pricing.interval) {
            priceParams.recurring = { interval: pricing.interval }
          }

          await stripe.price.create(priceParams)
        }
      }
    }
  }
  catch (err: any) {
    log.error(err)
  }
}