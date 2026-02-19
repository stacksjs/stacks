/**
 * Payment Facade
 *
 * Provides a unified, simplified interface for common payment operations.
 * Uses the underlying billable modules for Stripe integration.
 */


import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { stripe } from './drivers/stripe'
import { manageCharge } from './billable/charge'
import { manageCheckout } from './billable/checkout'
import { manageCustomer } from './billable/customer'
import { manageInvoice } from './billable/invoice'
import { managePaymentMethod } from './billable/payment-method'
import { managePrice } from './billable/price'
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

// =============================================================================
// Simple Payment Functions
// =============================================================================

/**
 * Create a one-time charge
 */
export async function charge(
  user: UserModel,
  amount: number,
  paymentMethod: string,
  options: Partial<Stripe.PaymentIntentCreateParams> = {},
): Promise<Stripe.PaymentIntent> {
  return manageCharge.charge(user, amount, paymentMethod, options as Stripe.PaymentIntentCreateParams)
}

/**
 * Create a payment intent (for client-side confirmation)
 */
export async function createPayment(
  user: UserModel,
  amount: number,
  options: Partial<Stripe.PaymentIntentCreateParams> = {},
): Promise<Stripe.PaymentIntent> {
  return manageCharge.createPayment(user, amount, options as Stripe.PaymentIntentCreateParams)
}

/**
 * Refund a payment
 */
export async function refund(
  paymentIntentId: string,
  amount?: number,
  options: Partial<Stripe.RefundCreateParams> = {},
): Promise<Stripe.Refund> {
  return manageCharge.refund(paymentIntentId, {
    amount,
    ...options,
  })
}

/**
 * Create a Stripe Checkout session
 */
export async function checkout(
  user: UserModel,
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
  options: Partial<Stripe.Checkout.SessionCreateParams> = {},
): Promise<Stripe.Checkout.Session> {
  return manageCheckout.create(user, {
    line_items: lineItems,
    mode: 'payment',
    ...options,
  } as Stripe.Checkout.SessionCreateParams)
}

/**
 * Create a subscription checkout session
 */
export async function subscriptionCheckout(
  user: UserModel,
  priceId: string,
  options: Partial<Stripe.Checkout.SessionCreateParams> = {},
): Promise<Stripe.Checkout.Session> {
  return manageCheckout.create(user, {
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    ...options,
  } as Stripe.Checkout.SessionCreateParams)
}

// =============================================================================
// Subscription Functions
// =============================================================================

/**
 * Create a new subscription
 */
export async function subscribe(
  user: UserModel,
  lookupKey: string,
  options: Partial<Stripe.SubscriptionCreateParams> = {},
): Promise<Stripe.Subscription> {
  return manageSubscription.create(user, 'default', lookupKey, options)
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately = false,
): Promise<Stripe.Subscription> {
  return manageSubscription.cancel(subscriptionId, {
    prorate: !immediately,
    invoice_now: immediately,
  } as any)
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(
  user: UserModel,
  type = 'default',
): Promise<boolean> {
  return manageSubscription.isValid(user, type)
}

/**
 * Update subscription to a new price
 */
export async function changeSubscription(
  user: UserModel,
  newLookupKey: string,
  type = 'default',
): Promise<Stripe.Subscription> {
  return manageSubscription.update(user, type, newLookupKey, {} as any)
}

// =============================================================================
// Customer Functions
// =============================================================================

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(
  user: UserModel,
  options: Stripe.CustomerCreateParams = {},
): Promise<Stripe.Customer> {
  return manageCustomer.createOrGetStripeUser(user, options)
}

/**
 * Update customer details
 */
export async function updateCustomer(
  user: UserModel,
  options: Stripe.CustomerCreateParams,
): Promise<Stripe.Customer> {
  return manageCustomer.updateStripeCustomer(user, options)
}

/**
 * Delete a customer from Stripe
 */
export async function deleteCustomer(user: UserModel): Promise<Stripe.DeletedCustomer> {
  return manageCustomer.deleteStripeUser(user)
}

// =============================================================================
// Payment Method Functions
// =============================================================================

/**
 * Add a payment method to a customer
 */
export async function addPaymentMethod(
  user: UserModel,
  paymentMethodId: string,
): Promise<Stripe.PaymentMethod> {
  return managePaymentMethod.addPaymentMethod(user, paymentMethodId)
}

/**
 * Set the default payment method
 */
export async function setDefaultPaymentMethod(
  user: UserModel,
  paymentMethodId: string,
): Promise<Stripe.Customer> {
  return managePaymentMethod.setUserDefaultPayment(user, paymentMethodId)
}

/**
 * Remove a payment method
 */
export async function removePaymentMethod(
  user: UserModel,
  paymentMethodId: number,
): Promise<Stripe.PaymentMethod> {
  return managePaymentMethod.deletePaymentMethod(user, paymentMethodId)
}

/**
 * Create a setup intent for adding payment methods
 */
export async function createSetupIntent(
  user: UserModel,
  options: Partial<Stripe.SetupIntentCreateParams> = {},
): Promise<Stripe.SetupIntent> {
  return manageSetupIntent.create(user, options as Stripe.SetupIntentCreateParams)
}

// =============================================================================
// Invoice Functions
// =============================================================================

/**
 * Get user's invoices
 */
export async function getInvoices(user: UserModel): Promise<Stripe.ApiList<Stripe.Invoice>> {
  return manageInvoice.list(user)
}

/**
 * Create an invoice
 */
export async function createInvoice(
  customerId: string,
  options: Partial<Stripe.InvoiceCreateParams> = {},
): Promise<Stripe.Invoice> {
  return stripe.invoices.create({
    customer: customerId,
    ...options,
  })
}

/**
 * Pay an invoice
 */
export async function payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
  return stripe.invoices.pay(invoiceId)
}

// =============================================================================
// Product & Price Functions
// =============================================================================

/**
 * Create a product with a price
 */
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

/**
 * Get a price by lookup key
 */
export async function getPrice(lookupKey: string): Promise<Stripe.Price | undefined> {
  return managePrice.retrieveByLookupKey(lookupKey)
}

/**
 * List all products
 */
export async function listProducts(
  options: Stripe.ProductListParams = {},
): Promise<Stripe.ApiList<Stripe.Product>> {
  return manageProduct.list(options)
}

// =============================================================================
// Coupon Functions
// =============================================================================

/**
 * Create a discount coupon
 */
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

/**
 * Create a promotion code from a coupon
 */
export async function createPromoCode(
  couponId: string,
  code: string,
  options: Partial<Stripe.PromotionCodeCreateParams> = {},
): Promise<Stripe.PromotionCode> {
  return manageCoupon.createPromotionCode({
    coupon: couponId,
    code,
    ...options,
  })
}

/**
 * Validate a promo code
 */
export async function validatePromoCode(code: string): Promise<Stripe.PromotionCode | null> {
  return manageCoupon.retrievePromotionCode(code)
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format amount for display
 */
export function formatAmount(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
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

// =============================================================================
// Payment Facade Object
// =============================================================================

export const Payment = {
  // Core payment operations
  charge,
  createPayment,
  refund,
  checkout,
  subscriptionCheckout,

  // Subscriptions
  subscribe,
  cancelSubscription,
  hasActiveSubscription,
  changeSubscription,

  // Customers
  getOrCreateCustomer,
  updateCustomer,
  deleteCustomer,

  // Payment methods
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

  // Low-level access
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
