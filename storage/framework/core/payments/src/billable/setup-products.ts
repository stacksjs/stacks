import type { Result } from '@stacksjs/error-handling'
import { saas } from '@stacksjs/config'
import { err, ok } from '@stacksjs/error-handling'
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
export async function createStripeProduct(): Promise<Result<string, Error>> {
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
  catch (error) {
    const e = error instanceof Error ? error : new Error(String(error))
    log.error(e)

    return err(e)
  }
}
