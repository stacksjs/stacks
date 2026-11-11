import type Stripe from 'stripe'
import { createRequire } from 'node:module'
import { services } from '@stacksjs/config'

const require = createRequire(import.meta.url)

type StripeConstructor = typeof Stripe

// The package owns the Stripe SDK used by its public declarations. Resolve
// the constructor on first use so importing payments does not initialize a
// provider client.
function StripeCtor(): StripeConstructor {
  try {
    return require('stripe') as StripeConstructor
  }
  catch {
    throw new Error(describeStripeAvailability({ key: true, sdk: false }) as string)
  }
}

let _stripe: Stripe | null = null

/** What Stripe needs in order to work, reported separately. */
export interface StripeAvailability {
  /** A secret key is configured. */
  key: boolean
  /** The required `stripe` dependency resolves in this installation. */
  sdk: boolean
}

/**
 * Whether the two things Stripe needs are actually present.
 *
 * Reported separately because an app that is missing both should be told
 * both: a missing key needs configuration, while a missing SDK means the
 * dependency installation needs restoring (stacksjs/stacks#2911).
 */
export function stripeAvailability(): StripeAvailability {
  return {
    key: Boolean(String(services?.stripe?.secretKey || '').trim()),
    sdk: isStripeSdkInstalled(),
  }
}

/**
 * Whether the required Stripe dependency resolves here.
 *
 * Check the actual installation. Do not cache a missing SDK across dependency
 * restoration or tests that temporarily hide the package.
 */
function isStripeSdkInstalled(): boolean {
  try {
    require.resolve('stripe')
    return true
  }
  catch {
    return false
  }
}

/**
 * Whether Stripe is usable in this process.
 *
 * This used to check only the secret key, so it answered `true` on a tree
 * where every Stripe call would throw - which is the one answer that makes
 * the function useless, since the reason to ask is to find that out.
 */
export function isStripeConfigured(): boolean {
  const { key, sdk } = stripeAvailability()
  return key && sdk
}

/**
 * Why Stripe cannot be used, or null when it can.
 *
 * Names everything that is missing rather than the first thing, so an app
 * missing both the key and the SDK is not told to fix one, redeploy, and
 * discover the other. Pure, so a caller can report on an availability it
 * gathered earlier - a boot check, a health endpoint, `doctor`.
 */
export function describeStripeAvailability(available: StripeAvailability): string | null {
  if (available.key && available.sdk)
    return null

  const reasons: string[] = []

  if (!available.sdk) {
    reasons.push(
      'the required `stripe` package is missing (restore the app dependencies with `bun install --frozen-lockfile`)',
    )
  }

  if (!available.key)
    reasons.push('no Stripe secret key is configured (set STRIPE_SECRET_KEY in your .env)')

  return `Stripe is being used but is not usable here: ${reasons.join('; and ')}.`
}

/**
 * Say so, once, when this process is set up for Stripe but cannot use it.
 *
 * Returns the message it reported, or null when there was nothing to say.
 *
 * Called from the API entry points so a tree with no SDK is one line at boot
 * rather than a 500 inside the first webhook (stacksjs/stacks#2911). It warns
 * rather than refusing to start: a missing SDK breaks billing, but unlike an
 * unresolvable middleware alias it cannot serve anything it should not, and
 * refusing would take down an app carrying a `STRIPE_SECRET_KEY` it no longer
 * uses.
 *
 * Only fires when a key is configured and the SDK is not. A key is what says
 * the app means to use Stripe; the driver name does not, since `stripe` is
 * the default for every app that never chose one. A missing key alone is
 * ordinary in development and says nothing.
 */
export function reportStripeAvailability(options: {
  /** Where the line goes. Defaults to `console.warn`. */
  warn?: (message: string) => void
  /** What to report on. Defaults to what this process actually has. */
  available?: StripeAvailability
} = {}): string | null {
  const available = options.available ?? stripeAvailability()
  if (!available.key || available.sdk)
    return null

  const message = describeStripeAvailability(available) as string
  ;(options.warn ?? console.warn)(`[stacks] ${message}`)
  return message
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
      // Both checks before either error, so an app missing the key AND the
      // SDK is told both. Checking the key first meant setting it produced a
      // different error, and the diagnosis took two deploys.
      const unusable = describeStripeAvailability(stripeAvailability())
      if (unusable)
        throw new Error(unusable)

      const apiKey = String(services?.stripe?.secretKey || '').trim()
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
