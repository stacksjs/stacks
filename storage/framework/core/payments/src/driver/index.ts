import type { UserModel } from '@stacksjs/orm'
import type { AdyenConfig } from './adyen'
import type { LemonSqueezyConfig } from './lemonsqueezy'
import type { PaddleConfig } from './paddle'
import type { StripeOperations } from './stripe'
import type { PaymentDriver } from './types'
import process from 'node:process'
import { config, services } from '@stacksjs/config'
import { manageCharge } from '../billable/charge'
import { manageCheckout } from '../billable/checkout'
import { manageCustomer } from '../billable/customer'
import { managePaymentMethod } from '../billable/payment-method'
import { manageSubscription } from '../billable/subscription'
import { constructEvent } from '../billable/webhook'
import { stripe } from '../drivers/stripe'
import { freshIdempotencyKey } from '../idempotency'
import { AdyenDriver } from './adyen'
import { LemonSqueezyDriver } from './lemonsqueezy'
import { PaddleDriver } from './paddle'
import { PaymentUnsupportedError } from './types'
import { StripeDriver } from './stripe'

export * from './adyen'
export * from './lemonsqueezy'
export * from './paddle'
export * from './paddle-checkout'
export * from './stripe'
export * from './types'

/** Stripe through the billable modules Stacks already had, so behaviour does not change. */
export const defaultStripeOperations: StripeOperations = {
  customer: payer => manageCustomer.createOrGetStripeUser(payer as unknown as UserModel, {}),
  createIntent: (payer, params, idempotencyKey) => stripe.paymentIntents.create(params, {
    idempotencyKey: idempotencyKey ?? freshIdempotencyKey('payment_intent.create', payer.id, params.amount),
  }),
  refund: (paymentIntentId, params) => manageCharge.refund(paymentIntentId, params),
  createCheckout: (payer, params) => manageCheckout.create(payer as unknown as UserModel, params),
  listPaymentMethods: async customerId => (await stripe.paymentMethods.list({ customer: customerId, limit: 100 })).data,
  deletePaymentMethod: (payer, paymentMethodId) => managePaymentMethod.deletePaymentMethod(payer as unknown as UserModel, paymentMethodId),
  subscribe: (payer, type, lookupKey) => manageSubscription.create(payer as unknown as UserModel, type, lookupKey, {}),
  cancelSubscription: (subscriptionId, atPeriodEnd) => atPeriodEnd
    ? manageSubscription.cancelAtPeriodEnd(subscriptionId)
    : manageSubscription.cancel(subscriptionId),
  listSubscriptions: async customerId => (await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })).data,
  constructEvent: (payload, signature, secret) => constructEvent(payload, signature, secret),
}

type DriverFactory = () => PaymentDriver

const BUILT_IN_DRIVERS = ['stripe', 'adyen', 'paddle', 'lemonsqueezy']

const custom = new Map<string, DriverFactory>()

/**
 * Make a driver of your own available as `config.payment.driver`. A built-in
 * name cannot be replaced, so `stripe` always means Stacks' Stripe driver.
 */
export function registerPaymentDriver(name: string, factory: DriverFactory): void {
  if (BUILT_IN_DRIVERS.includes(name))
    throw new Error(`"${name}" is a built-in payment driver and cannot be replaced.`)
  custom.set(name, factory)
}

interface PaymentSettings {
  driver?: string
  stripe?: { webhookSecret?: string }
  adyen?: Partial<AdyenConfig>
  paddle?: Partial<PaddleConfig>
  lemonsqueezy?: Partial<LemonSqueezyConfig>
}

/** Adyen's settings: config/payment.ts, then the ADYEN_* environment. */
export function adyenConfig(settings: Partial<AdyenConfig> = {}, env: Record<string, string | undefined> = process.env): AdyenConfig {
  const environment = settings.environment ?? (env.ADYEN_ENVIRONMENT === 'live' ? 'live' : 'test')
  return {
    apiKey: settings.apiKey || env.ADYEN_API_KEY || '',
    merchantAccount: settings.merchantAccount || env.ADYEN_MERCHANT_ACCOUNT || '',
    environment,
    liveUrlPrefix: settings.liveUrlPrefix || env.ADYEN_LIVE_URL_PREFIX || undefined,
    hmacKey: settings.hmacKey || env.ADYEN_HMAC_KEY || undefined,
    shopperReferencePrefix: settings.shopperReferencePrefix,
  }
}

/** Paddle's settings: config/payment.ts, then the PADDLE_* environment. */
export function paddleConfig(settings: Partial<PaddleConfig> = {}, env: Record<string, string | undefined> = process.env): PaddleConfig {
  const environment = settings.environment ?? (env.PADDLE_ENVIRONMENT === 'live' ? 'live' : 'sandbox')
  return {
    apiKey: settings.apiKey || env.PADDLE_API_KEY || '',
    environment,
    webhookSecret: settings.webhookSecret || env.PADDLE_WEBHOOK_SECRET || undefined,
    clientToken: settings.clientToken || env.PADDLE_CLIENT_TOKEN || undefined,
    taxCategory: settings.taxCategory || env.PADDLE_TAX_CATEGORY || undefined,
    webhookTolerance: settings.webhookTolerance,
  }
}

/** Lemon Squeezy's settings: config/payment.ts, then the LEMONSQUEEZY_* environment. */
export function lemonSqueezyConfig(settings: Partial<LemonSqueezyConfig> = {}, env: Record<string, string | undefined> = process.env): LemonSqueezyConfig {
  return {
    apiKey: settings.apiKey || env.LEMONSQUEEZY_API_KEY || '',
    storeId: settings.storeId || env.LEMONSQUEEZY_STORE_ID || '',
    webhookSecret: settings.webhookSecret || env.LEMONSQUEEZY_WEBHOOK_SECRET || undefined,
    customPriceVariantId: settings.customPriceVariantId || env.LEMONSQUEEZY_VARIANT_ID || undefined,
    testMode: settings.testMode ?? env.LEMONSQUEEZY_TEST_MODE === 'true',
  }
}

/** The driver `config.payment.driver` names: `stripe` unless it says otherwise. */
export function configuredPaymentDriver(): string {
  return ((config as { payment?: PaymentSettings }).payment ?? {}).driver ?? 'stripe'
}

/**
 * Refuse a Stripe-only operation when the app pays through another provider,
 * naming the operation - rather than reaching Stripe with keys the app does
 * not have, or quietly mixing two providers' customers.
 */
export function assertStripeDriver(operation: string): void {
  const configured = configuredPaymentDriver()
  if (configured !== 'stripe')
    throw new PaymentUnsupportedError(configured, operation, 'it is a Stripe-only operation')
}

/**
 * The payment driver `config.payment.driver` names - `stripe` unless it says
 * otherwise - or the one named here. This is the first thing to read that
 * setting: it used to be declared, typed as `'stripe'`, and ignored.
 */
export function paymentDriver(name?: string): PaymentDriver {
  const settings = ((config as { payment?: PaymentSettings }).payment ?? {})
  const chosen = name ?? configuredPaymentDriver()

  if (chosen === 'stripe') {
    return new StripeDriver({
      operations: defaultStripeOperations,
      webhookSecret: settings.stripe?.webhookSecret || (services as { stripe?: { webhookSecret?: string } })?.stripe?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || undefined,
    })
  }
  if (chosen === 'adyen') {
    const appUrl = (config as { app?: { url?: string } }).app?.url
    return new AdyenDriver({ ...adyenConfig(settings.adyen), ...(appUrl ? { appUrl } : {}) })
  }
  if (chosen === 'paddle') {
    const appUrl = (config as { app?: { url?: string } }).app?.url
    return new PaddleDriver({ ...paddleConfig(settings.paddle), ...(appUrl ? { appUrl } : {}) })
  }

  if (chosen === 'lemonsqueezy') {
    const appUrl = (config as { app?: { url?: string } }).app?.url
    return new LemonSqueezyDriver({ ...lemonSqueezyConfig(settings.lemonsqueezy), ...(appUrl ? { appUrl } : {}) })
  }

  const factory = custom.get(chosen)
  if (!factory)
    throw new Error(`No payment driver named "${chosen}". Built in: ${BUILT_IN_DRIVERS.join(', ')}${custom.size ? `; registered: ${[...custom.keys()].join(', ')}` : ''}.`)
  return factory()
}
