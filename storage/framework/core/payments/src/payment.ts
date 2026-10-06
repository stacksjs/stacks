/**
 * The Payment facade (stacksjs/stacks#665).
 *
 * Two halves, and which half a function is in is the whole point:
 *
 *   - **Provider-neutral.** `charge`, `createPayment`, `refund`, `checkout`,
 *     `subscriptionCheckout`, `subscribe`, `cancelSubscription`,
 *     `subscriptions`, `hasActiveSubscription`, `getOrCreateCustomer`,
 *     `paymentMethods` and `removePaymentMethod` go through the driver
 *     `config.payment.driver` selects. Money is `{ amount, currency }` in minor
 *     units and results are the driver's own shapes, so the same call works on
 *     Stripe and Adyen. They used to take Stripe parameters and return Stripe
 *     objects whatever the configuration said.
 *   - **Stripe only.** Invoices, products and prices, coupons and promotion
 *     codes, the billing portal, setup intents, changing a subscription's
 *     price, customer edits, webhooks, Connect and the raw client are Stripe
 *     concepts. They keep Stripe's types and refuse, naming the operation, when
 *     another provider is configured.
 *
 * Anything Stripe-specific the neutral half cannot say (a Connect destination
 * charge, `prorate` on a cancellation) is the `manage*` modules' job.
 */

import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import type {
  ChargeOptions,
  CheckoutRequest,
  CheckoutSession,
  CreatePaymentOptions,
  Customer,
  Money,
  Payer,
  PaymentResult,
  RefundOptions,
  RefundResult,
  StoredPaymentMethod,
  SubscriptionSummary,
} from './driver'
import { stripe } from './drivers/stripe'
import { manageCustomer } from './billable/customer'
import { manageInvoice } from './billable/invoice'
import { managePaymentMethod } from './billable/payment-method'
import { managePrice } from './billable/price'
import { manageBillingPortal } from './billable/portal'
import { manageCoupon, managePriceExtended, manageProduct } from './billable/product'
import { manageSubscription } from './billable/subscription'
import { manageSetupIntent } from './billable/intent'
import {
  manageWebhook,
  onCharge,
  onCheckout,
  onInvoice,
  onPaymentIntent,
  onSubscription,
  processWebhook,
} from './billable/webhook'
import { connect } from './connect'
import { assertStripeDriver, paymentDriver } from './driver'

// =============================================================================
// Payments - provider-neutral
// =============================================================================

/** Charge a stored payment method, server side. */
export async function charge(
  payer: Payer,
  amount: Money,
  paymentMethod: string,
  options: ChargeOptions = {},
): Promise<PaymentResult> {
  return paymentDriver().charge(payer, amount, paymentMethod, options)
}

/**
 * Start a payment the browser completes with the provider's SDK. The result's
 * `clientConfirmation` says how: a Stripe client secret, or an Adyen session.
 */
export async function createPayment(
  payer: Payer,
  amount: Money,
  options: CreatePaymentOptions = {},
): Promise<PaymentResult> {
  return paymentDriver().createPayment(payer, amount, options)
}

/** Refund a payment: all of it, or `options.amount` of it. */
export async function refund(paymentId: string, options: RefundOptions = {}): Promise<RefundResult> {
  return paymentDriver().refund(paymentId, options)
}

/** A hosted checkout page; send the payer to the session's `url`. */
export async function checkout(payer: Payer, request: CheckoutRequest): Promise<CheckoutSession> {
  return paymentDriver().checkout(payer, request)
}

/** A hosted checkout that starts a subscription to one price. */
export async function subscriptionCheckout(
  payer: Payer,
  price: string,
  options: Omit<CheckoutRequest, 'mode' | 'lines'> & { quantity?: number },
): Promise<CheckoutSession> {
  const { quantity = 1, ...request } = options
  return paymentDriver().checkout(payer, { ...request, mode: 'subscription', lines: [{ price, quantity }] })
}

// =============================================================================
// Subscriptions - provider-neutral
// =============================================================================

/** Subscribe to `price` (a Stripe lookup key). `type` names it locally, `default` unless given. */
export async function subscribe(
  payer: Payer,
  price: string,
  options: { type?: string } = {},
): Promise<SubscriptionSummary> {
  return paymentDriver().subscribe(payer, price, options)
}

/**
 * Cancel now, or with `atPeriodEnd` stop renewing and let the customer keep
 * what they paid for until the period ends.
 *
 * Replaces `cancelSubscription(id, immediately)`, whose `false` cancelled
 * immediately anyway, only with a proration. Stripe's `prorate` and
 * `invoice_now` are `manageSubscription.cancel`'s to pass.
 */
export async function cancelSubscription(
  subscriptionId: string,
  options: { atPeriodEnd?: boolean } = {},
): Promise<SubscriptionSummary> {
  return paymentDriver().cancelSubscription(subscriptionId, options)
}

/** The provider's subscriptions for this payer, every status included. */
export async function subscriptions(payer: Payer): Promise<SubscriptionSummary[]> {
  return paymentDriver().subscriptions(payer)
}

/**
 * Whether the user holds an entitling subscription of `type`. Answered from
 * the local `subscriptions` table, which the webhook keeps current, so it does
 * not ask the provider.
 */
export async function hasActiveSubscription(user: UserModel, type = 'default'): Promise<boolean> {
  return manageSubscription.isValid(user, type)
}

/** Switch the user's subscription of `type` to another price, prorated. Stripe only. */
export async function changeSubscription(
  user: UserModel,
  newLookupKey: string,
  type = 'default',
): Promise<Stripe.Subscription> {
  assertStripeDriver('changeSubscription')
  return manageSubscription.update(user, type, newLookupKey, {})
}

// =============================================================================
// Customers
// =============================================================================

/** The provider's customer for this payer, created on first use. */
export async function getOrCreateCustomer(payer: Payer): Promise<Customer> {
  return paymentDriver().customer(payer)
}

/** Update the Stripe customer's details. Stripe only. */
export async function updateCustomer(
  user: UserModel,
  options: Stripe.CustomerUpdateParams,
): Promise<Stripe.Customer> {
  assertStripeDriver('updateCustomer')
  return manageCustomer.updateStripeCustomer(user, options)
}

/** Delete the Stripe customer. Stripe only. */
export async function deleteCustomer(user: UserModel): Promise<Stripe.DeletedCustomer> {
  assertStripeDriver('deleteCustomer')
  return manageCustomer.deleteStripeUser(user)
}

// =============================================================================
// Payment methods
// =============================================================================

/** The payment methods the provider holds for this payer, the default marked. */
export async function paymentMethods(payer: Payer): Promise<StoredPaymentMethod[]> {
  return paymentDriver().paymentMethods(payer)
}

/**
 * Detach a payment method, by the provider's id for it (as `paymentMethods`
 * lists it). It used to take the local `payment_methods` row id as well; that
 * is `managePaymentMethod.deletePaymentMethod`'s to do.
 */
export async function removePaymentMethod(payer: Payer, paymentMethodId: string): Promise<void> {
  return paymentDriver().removePaymentMethod(payer, paymentMethodId)
}

/** Attach a card the browser collected with a setup intent. Stripe only. */
export async function addPaymentMethod(
  user: UserModel,
  paymentMethodId: string,
): Promise<Stripe.PaymentMethod> {
  assertStripeDriver('addPaymentMethod')
  return managePaymentMethod.addPaymentMethod(user, paymentMethodId)
}

/** Make a payment method the customer's default. Stripe only. */
export async function setDefaultPaymentMethod(
  user: UserModel,
  paymentMethodId: string,
): Promise<Stripe.Customer> {
  assertStripeDriver('setDefaultPaymentMethod')
  return managePaymentMethod.setUserDefaultPayment(user, paymentMethodId)
}

/** A setup intent, for collecting a card in the browser without charging it. Stripe only. */
export async function createSetupIntent(
  user: UserModel,
  options: Partial<Stripe.SetupIntentCreateParams> = {},
): Promise<Stripe.SetupIntent> {
  assertStripeDriver('createSetupIntent')
  return manageSetupIntent.create(user, options as Stripe.SetupIntentCreateParams)
}

// =============================================================================
// Invoices - Stripe only
// =============================================================================

export async function getInvoices(user: UserModel): Promise<Stripe.ApiList<Stripe.Invoice>> {
  assertStripeDriver('getInvoices')
  return manageInvoice.list(user)
}

export async function createInvoice(
  customerId: string,
  options: Partial<Stripe.InvoiceCreateParams> = {},
): Promise<Stripe.Invoice> {
  assertStripeDriver('createInvoice')
  return stripe.invoices.create({
    customer: customerId,
    ...options,
  })
}

export async function payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
  assertStripeDriver('payInvoice')
  return stripe.invoices.pay(invoiceId)
}

// =============================================================================
// Products & prices - Stripe only
// =============================================================================

/** Create a product with a price. Amounts in minor units. */
export async function createProduct(
  name: string,
  price: number,
  options: {
    currency?: string
    interval?: 'day' | 'week' | 'month' | 'year'
    description?: string
    metadata?: Stripe.MetadataParam
  } = {},
): Promise<{ product: Stripe.Product, price: Stripe.Price }> {
  assertStripeDriver('createProduct')
  const { currency = 'usd', interval, description, metadata } = options

  const priceParams: Omit<Stripe.PriceCreateParams, 'product'> = {
    unit_amount: price,
    currency,
  }

  if (interval) {
    priceParams.recurring = { interval }
  }

  return manageProduct.createWithPrice(
    {
      name,
      description,
      metadata,
    },
    priceParams,
  )
}

/** A price by its lookup key. */
export async function getPrice(lookupKey: string): Promise<Stripe.Price | undefined> {
  assertStripeDriver('getPrice')
  return managePrice.retrieveByLookupKey(lookupKey)
}

export async function listProducts(
  options: Stripe.ProductListParams = {},
): Promise<Stripe.ApiList<Stripe.Product>> {
  assertStripeDriver('listProducts')
  return manageProduct.list(options)
}

// =============================================================================
// Coupons - Stripe only
// =============================================================================

export async function createCoupon(
  options: {
    percentOff?: number
    amountOff?: number
    currency?: string
    duration?: 'forever' | 'once' | 'repeating'
    durationInMonths?: number
    name?: string
    maxRedemptions?: number
  },
): Promise<Stripe.Coupon> {
  assertStripeDriver('createCoupon')
  const params: Stripe.CouponCreateParams = {
    duration: options.duration || 'once',
  }

  if (options.percentOff) {
    params.percent_off = options.percentOff
  }
  else if (options.amountOff) {
    params.amount_off = options.amountOff
    params.currency = options.currency || 'usd'
  }

  if (options.name) params.name = options.name
  if (options.durationInMonths) params.duration_in_months = options.durationInMonths
  if (options.maxRedemptions) params.max_redemptions = options.maxRedemptions

  return manageCoupon.create(params)
}

export async function createPromoCode(
  couponId: string,
  code: string,
  options: Partial<Stripe.PromotionCodeCreateParams> = {},
): Promise<Stripe.PromotionCode> {
  assertStripeDriver('createPromoCode')
  return manageCoupon.createPromotionCode({
    promotion: { type: 'coupon', coupon: couponId },
    code,
    ...options,
  })
}

export async function validatePromoCode(code: string): Promise<Stripe.PromotionCode | null> {
  assertStripeDriver('validatePromoCode')
  return manageCoupon.retrievePromotionCode(code)
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format amount for display.
 *
 * Currency defaults to the project's configured payment currency
 * (`config.payment.currency` / `STRIPE_CURRENCY`), falling back to USD only
 * when nothing else is set. Locale follows the same pattern via
 * `config.app.locale` so EU merchants see €1.234,56 not $1,234.56.
 */
export function formatAmount(amount: number, currency?: string): string {
  const cfg = ((globalThis as { config?: any }).config) || {}
  const ccy = (currency
    || cfg.payment?.currency
    || cfg.billing?.currency
    || process.env.STRIPE_CURRENCY
    || 'usd').toLowerCase()
  const locale = cfg.app?.locale || 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: ccy.toUpperCase(),
  }).format(amount / 100)
}

/**
 * Convert dollars to cents
 */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Convert cents to dollars
 */
export function toDollars(cents: number): number {
  return cents / 100
}

/**
 * A link into the Stripe customer portal (Stripe only), where the customer manages their
 * subscription, card and invoices. Takes a Stripe customer id, or a user with
 * one. The link is single-use and short-lived: create it when they click.
 */
export async function billingPortal(
  customer: string | UserModel,
  options: { returnUrl?: string } = {},
): Promise<Stripe.BillingPortal.Session> {
  assertStripeDriver('billingPortal')
  const customerId = typeof customer === 'string' ? customer : customer.stripe_id
  if (!customerId)
    throw new Error('billingPortal needs a Stripe customer: this user has no stripe_id yet.')
  return manageBillingPortal.createSession(customerId, options)
}

// =============================================================================
// Payment Facade Object
// =============================================================================

export const Payment = {
  /**
   * The driver `config.payment.driver` selects - Stripe or Adyen - for what
   * the functions below do not cover (webhooks: `verifyWebhook`,
   * `acknowledgeWebhook`).
   */
  driver: paymentDriver,

  // Payments (provider-neutral)
  charge,
  createPayment,
  refund,
  checkout,
  subscriptionCheckout,

  // Subscriptions (provider-neutral, but changeSubscription)
  subscribe,
  cancelSubscription,
  subscriptions,
  hasActiveSubscription,
  changeSubscription,

  // Customers (getOrCreateCustomer is provider-neutral)
  getOrCreateCustomer,
  updateCustomer,
  deleteCustomer,

  // Payment methods (paymentMethods and removePaymentMethod are provider-neutral)
  paymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  createSetupIntent,

  // Invoices
  getInvoices,
  createInvoice,
  payInvoice,

  // Products & Prices
  createProduct,
  getPrice,
  listProducts,

  // Customer portal
  billingPortal,

  // Coupons
  createCoupon,
  createPromoCode,
  validatePromoCode,

  // Utilities
  formatAmount,
  toCents,
  toDollars,

  // Webhooks
  webhook: manageWebhook,
  onPaymentIntent,
  onSubscription,
  onInvoice,
  onCheckout,
  onCharge,
  processWebhook,

  // Marketplaces (Stripe Connect)
  connect,

  // Low-level Stripe access
  stripe,
  customer: manageCustomer,
  subscription: manageSubscription,
  invoice: manageInvoice,
  paymentMethod: managePaymentMethod,
  product: manageProduct,
  price: managePriceExtended,
  coupon: manageCoupon,
}

export default Payment
