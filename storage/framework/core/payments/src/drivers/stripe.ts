import type Stripe from 'stripe'
import { createRequire } from 'node:module'
import { services } from '@stacksjs/config'

const require = createRequire(import.meta.url)

// `stripe` is an opt-in dependency: it is only installed when Stripe payments
// are enabled in config. Resolved lazily (synchronously, on first use) so
// importing `@stacksjs/payments` never hard-requires the package.
function StripeCtor(): typeof import('stripe').default {
  try {
    return require('stripe')
  }
  catch {
    throw new Error(
      'Stripe payments are being used but the `stripe` package is not installed. '
      + 'It is an opt-in dependency — run `bun add stripe` to enable server-side Stripe payments.',
    )
  }
}

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
      const apiVersion: Stripe.LatestApiVersion = '2026-03-25.dahlia'
      const configuredVersion = services?.stripe?.apiVersion
      if (configuredVersion && configuredVersion !== apiVersion)
        throw new Error(`Stripe API version ${configuredVersion} does not match the installed SDK version ${apiVersion}`)
      const Stripe = StripeCtor()
      _stripe = new Stripe(apiKey, { apiVersion })
    }
    return (_stripe as any)[prop]
  },
})
