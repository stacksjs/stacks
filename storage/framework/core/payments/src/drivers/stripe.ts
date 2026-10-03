import type Stripe from 'stripe'
import { createRequire } from 'node:module'
import { services } from '@stacksjs/config'

const require = createRequire(import.meta.url)

type StripeConstructor = typeof Stripe

// `stripe` is an opt-in dependency: it is only installed when Stripe payments
// are enabled in config. Resolved lazily (synchronously, on first use) so
// importing `@stacksjs/payments` never hard-requires the package.
function StripeCtor(): StripeConstructor {
  try {
    return require('stripe') as StripeConstructor
  }
  catch {
    throw new Error(
      'Stripe payments are being used but the `stripe` package is not installed. '
      + 'It is an opt-in dependency - run `bun add stripe` to enable server-side Stripe payments.',
    )
  }
}

let _stripe: Stripe | null = null

/** Whether this process has the credential required to make Stripe calls. */
export function isStripeConfigured(): boolean {
  return Boolean(String(services?.stripe?.secretKey || '').trim())
}

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
      // The API version is the one the installed SDK's types describe, read
      // from the SDK itself: a hand-written copy here had to be edited in
      // step with every major and was not (it pinned 22's version under 23).
      // A configured version must match it, since responses in any other
      // version carry fields the SDK's types do not know about.
      const Stripe = StripeCtor()
      const apiVersion = Stripe.API_VERSION
      const configuredVersion = services?.stripe?.apiVersion
      if (configuredVersion && configuredVersion !== apiVersion)
        throw new Error(`Stripe API version ${configuredVersion} does not match the installed SDK version ${apiVersion}`)
      _stripe = new Stripe(apiKey, { apiVersion })
    }
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop]
  },
})
