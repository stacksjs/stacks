
import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { config } from '@stacksjs/config'
import { stripe } from '..'

export interface Checkout {
  create: (user: UserModel, params: Stripe.Checkout.SessionCreateParams) => Promise<Stripe.Response<Stripe.Checkout.Session>>
}

/**
 * Validate that a redirect target URL is on the configured app origin.
 * Without this, an attacker who could influence params (e.g. via a
 * forged form) could route the post-payment redirect to a phishing
 * site impersonating the brand. We compare origins (scheme+host+port)
 * so subdomains and paths are still flexible within the trust boundary.
 */
function assertSameOriginUrl(url: string | undefined, label: string): void {
  if (!url) return
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    throw new Error(`[payments/checkout] ${label} is not a valid URL: ${url}`)
  }
  const appUrl = (config as { app?: { url?: string } })?.app?.url
  if (!appUrl) return // no configured origin to enforce — trust the caller
  let appOrigin: string
  try {
    appOrigin = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`).origin
  }
  catch {
    return
  }
  if (parsed.origin !== appOrigin) {
    throw new Error(`[payments/checkout] ${label} origin (${parsed.origin}) does not match app origin (${appOrigin})`)
  }
}

export const manageCheckout: Checkout = (() => {
  async function create(user: UserModel, params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    if (!user.stripe_id) {
      throw new Error('User has no Stripe ID')
    }

    assertSameOriginUrl(params.success_url, 'success_url')
    assertSameOriginUrl(params.cancel_url, 'cancel_url')

    const defaultParams: Partial<Stripe.Checkout.SessionCreateParams> = {
      customer: user.stripe_id,
      mode: 'payment',
      success_url: params.success_url,
      cancel_url: params.cancel_url,
    }

    const mergedParams = { ...defaultParams, ...params }

    return await stripe.checkout.sessions.create(mergedParams)
  }

  return { create }
})()
