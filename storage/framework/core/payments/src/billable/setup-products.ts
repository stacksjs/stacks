import type { Err, Ok } from '@stacksjs/error-handling'
import { saas } from '@stacksjs/config'
import { ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { stripe } from '@stacksjs/payments'

interface PriceParams {
  unit_amount: number
  currency: string
  product: string
  lookup_key: string
  recurring?: {
    interval: 'day' | 'month' | 'week' | 'year'
  }
}
export async function createStripeProduct(): Promise<Ok<string, never> | Err<string, any>> {
  const plans = saas.plans
  try {
    if (plans !== undefined && plans.length) {
      for (const plan of plans) {
        // First, create the product in Stripe
        const product = await stripe.products.create({
          name: plan.productName,
          description: plan.description,
          metadata: plan.metadata,
        })

        // Use the created product's ID to add the pricing options
        for (const pricing of plan.pricing) {
          if (product) {
            const priceParams: PriceParams = {
              unit_amount: pricing.price,
              currency: pricing.currency,
              product: product.id,
              lookup_key: pricing.key,
            }

            if (pricing.interval) {
              priceParams.recurring = { interval: pricing.interval }
            }

            await stripe.prices.create(priceParams)
          }
        }
      }
    }

    return ok('Migrations generated')
  }
  catch (err: any) {
    log.error(err)

    return err(err)
  }
}
