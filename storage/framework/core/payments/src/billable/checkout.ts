
import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { config } from '@stacksjs/config'
import { stripe } from '../drivers/stripe'
import { freshIdempotencyKey } from '../idempotency'

export interface Checkout {
  create: (user: UserModel, params: Stripe.Checkout.SessionCreateParams, options?: CheckoutOptions) => Promise<Stripe.Response<Stripe.Checkout.Session>>
}

interface CheckoutOptions {
  idempotencyKey?: string
}

/**
 * Validate a redirect target against the app origin and explicitly configured browser origins.
 * Without this, an attacker who could influence params (e.g. via a
 * forged form) could route the post-payment redirect to a phishing
 * site impersonating the brand. We compare origins (scheme+host+port)
 * so subdomains and paths are still flexible within the trust boundary.
 */
export function assertSameOriginUrl(url: string | undefined, label: string): void {
  if (!url) return
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    throw new Error(`[payments/checkout] ${label} is not a valid URL: ${url}`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error(`[payments/checkout] ${label} must be an HTTP URL without credentials`)
  const appUrl = (config as { app?: { url?: string } })?.app?.url
  if (!appUrl) return // no configured origin to enforce — trust the caller
  let appOrigin: string
  try {
    appOrigin = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`).origin
  }
  catch {
    return
  }
  const browserOrigins = config.payment?.checkoutReturnOrigins ?? []
  const allowedOrigins = browserOrigins.map((value) => {
    try {
      const origin = new URL(value)
      if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
        throw new Error('Not a bare origin')
      return origin.origin
    }
    catch { throw new Error('[payments/checkout] checkoutReturnOrigins must contain bare HTTP origins without credentials') }
  })
  if (parsed.origin !== appOrigin && !allowedOrigins.includes(parsed.origin)) {
    throw new Error(`[payments/checkout] ${label} origin (${parsed.origin}) does not match app origin (${appOrigin})`)
  }
}

export const manageCheckout: Checkout = (() => {
  async function create(user: UserModel, params: Stripe.Checkout.SessionCreateParams, options: CheckoutOptions = {}): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    const { idempotencyKey } = options
    if (idempotencyKey !== undefined && (!idempotencyKey.trim() || idempotencyKey.length > 255))
      throw new TypeError('A Stripe checkout idempotency key must be nonblank and at most 255 characters.')

    // The billable `checkout()` resolves/creates the Stripe customer first and
    // passes it in `params.customer`; fall back to the persisted `stripe_id`.
    // (`user.hasStripeId()` is not bound onto the model by the billable trait,
    // so calling it throws — use the resolved id instead.)
    const customerId = (params as { customer?: string }).customer || user.stripe_id
    if (!customerId) {
      throw new Error('User has no Stripe customer')
    }

    assertSameOriginUrl(params.success_url, 'success_url')
    assertSameOriginUrl(params.cancel_url, 'cancel_url')

    const defaultParams: Partial<Stripe.Checkout.SessionCreateParams> = {
      customer: customerId,
      mode: 'payment',
      success_url: params.success_url,
      cancel_url: params.cancel_url,
    }

    const mergedParams = { ...defaultParams, ...params }

    // Apps that persist an attempt can retry it after losing Stripe's reply.
    // Preserve a fresh key for every caller that starts a new attempt.
    return await stripe.checkout.sessions.create(mergedParams, {
      idempotencyKey: idempotencyKey ?? freshIdempotencyKey('checkout.session.create', user.id),
    })
  }

  return { create }
})()
