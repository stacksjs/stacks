import { services } from '@stacksjs/config'
import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Lazy-initialized Stripe instance.
 * Only throws when you actually try to use Stripe, not at module load time.
 * This allows the payments package to be imported without a configured key
 * (e.g., in tests, CLI, or environments that don't use Stripe).
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      const apiKey = services?.stripe?.secretKey
      if (!apiKey) {
        throw new Error('Stripe secret key is not configured. Set STRIPE_SECRET_KEY in your .env file.')
      }
      // Pin the API version through config so deployments can roll
      // forward without a code change. The fallback matches what the
      // pantry-vendored Stripe SDK types are compiled against — bumping
      // it here without bumping the SDK would mean responses include
      // fields the SDK doesn't know about. Update both at once.
      const apiVersion = (services?.stripe?.apiVersion as Stripe.LatestApiVersion | undefined)
        ?? '2026-01-28.preview'
      _stripe = new Stripe(apiKey, { apiVersion })
    }
    return (_stripe as any)[prop]
  },
})
