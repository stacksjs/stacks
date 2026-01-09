/**
 * Payment Types
 *
 * Type definitions for the payments module.
 */

import type Stripe from 'stripe'

// =============================================================================
// Configuration Types
// =============================================================================

export interface PaymentOptions {
  /**
   * Payment provider
   */
  driver: 'stripe'

  /**
   * Stripe configuration
   */
  stripe: StripeConfig

  /**
   * Default currency (ISO 4217 code)
   */
  currency?: string

  /**
   * Webhook configuration
   */
  webhook?: WebhookConfig
}

export interface StripeConfig {
  /**
   * Stripe publishable key (client-side)
   */
  publishableKey: string

  /**
   * Stripe secret key (server-side)
   */
  secretKey: string

  /**
   * Stripe API version
   */
  apiVersion?: string

  /**
   * Webhook signing secret
   */
  webhookSecret?: string
}

export interface WebhookConfig {
  /**
   * Webhook endpoint secret
   */
  secret: string

  /**
   * Tolerance in seconds for webhook timestamp verification
   */
  tolerance?: number
}

export type PaymentConfig = Partial<PaymentOptions>

// =============================================================================
// Customer Types
// =============================================================================

export interface StripeCustomerOptions {
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  name?: string
  phone?: string
  metadata?: Stripe.Emptyable<Stripe.MetadataParam>
  email?: string
  preferred_locales?: string[]
}

export interface CustomerOptions {
  description?: string
  address?: string
  email?: string
  metadata?: Record<string, string>
  name?: string
  payment_method?: string
  shipping?: ShippingInfo
  listOptions?: {
    created?: Record<string, unknown>
    ending_before?: string
    limit?: number
    starting_after?: string
    test_clock?: string
  }
  searchOptions?: {
    query?: string
    limit?: number
    page?: number
  }
}

export interface ShippingInfo {
  address: {
    line1: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  name: string
  phone?: string
}

// =============================================================================
// Charge Types
// =============================================================================

export interface ChargeOptions {
  currency?: string
  source?: string
  description?: string
  chargeId?: string
  limit?: number
  metadata?: Record<string, string>
  searchOptions?: {
    query?: string
    limit?: number
  }
}

export interface ChargeResult {
  id: string
  amount: number
  currency: string
  status: 'succeeded' | 'pending' | 'failed'
  paymentMethod?: string
  receiptUrl?: string
  refunded: boolean
  refundedAmount?: number
}

// =============================================================================
// Checkout Types
// =============================================================================

export interface CheckoutLineItem {
  priceId: string
  quantity: number
}

export interface CheckoutOptions extends Partial<Stripe.Checkout.SessionCreateParams> {
  /**
   * Enable automatic tax calculation
   */
  enableTax?: boolean

  /**
   * Allow promotion codes
   */
  allowPromotions?: boolean
}

export interface CheckoutSessionResult {
  id: string
  url: string | null
  status: string
  customerId?: string
  subscriptionId?: string
  paymentIntentId?: string
}

// =============================================================================
// Subscription Types
// =============================================================================

export interface SubscriptionOptions {
  /**
   * Subscription type/name
   */
  type: string

  /**
   * Price lookup key
   */
  lookupKey: string

  /**
   * Trial period in days
   */
  trialDays?: number

  /**
   * Coupon or promotion code
   */
  coupon?: string

  /**
   * Additional metadata
   */
  metadata?: Record<string, string>
}

export interface SubscriptionResult {
  id: string
  status: SubscriptionStatus
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  items: SubscriptionItem[]
  latestInvoiceId?: string
}

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'paused'
  | 'trialing'
  | 'unpaid'

export interface SubscriptionItem {
  id: string
  priceId: string
  productId: string
  quantity: number
}

// =============================================================================
// Invoice Types
// =============================================================================

export interface InvoiceResult {
  id: string
  number: string | null
  status: InvoiceStatus
  amountDue: number
  amountPaid: number
  currency: string
  dueDate: Date | null
  paidAt: Date | null
  hostedInvoiceUrl: string | null
  pdfUrl: string | null
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'uncollectible'
  | 'void'

// =============================================================================
// Payment Method Types
// =============================================================================

export interface PaymentMethodResult {
  id: string
  type: PaymentMethodType
  card?: CardDetails
  isDefault: boolean
}

export type PaymentMethodType =
  | 'card'
  | 'bank_account'
  | 'sepa_debit'
  | 'ideal'
  | 'sofort'
  | 'giropay'

export interface CardDetails {
  brand: string
  last4: string
  expMonth: number
  expYear: number
  funding: 'credit' | 'debit' | 'prepaid' | 'unknown'
}

// =============================================================================
// Product & Price Types
// =============================================================================

export interface ProductOptions {
  name: string
  description?: string
  images?: string[]
  metadata?: Record<string, string>
  active?: boolean
}

export interface PriceOptions {
  productId: string
  unitAmount: number
  currency?: string
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year'
    intervalCount?: number
  }
  lookupKey?: string
  metadata?: Record<string, string>
}

// =============================================================================
// Coupon Types
// =============================================================================

export interface CouponOptions {
  id?: string
  name?: string
  percentOff?: number
  amountOff?: number
  currency?: string
  duration: 'forever' | 'once' | 'repeating'
  durationInMonths?: number
  maxRedemptions?: number
  redeemBy?: Date
}

export interface PromotionCodeOptions {
  couponId: string
  code: string
  maxRedemptions?: number
  expiresAt?: Date
  firstTimeTransaction?: boolean
  minimumAmount?: number
  minimumAmountCurrency?: string
}

// =============================================================================
// Webhook Types
// =============================================================================

export type WebhookEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.created'
  | 'payment_intent.canceled'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.finalized'
  | 'invoice.created'
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'charge.dispute.closed'
  | 'payment_method.attached'
  | 'payment_method.detached'
  | 'setup_intent.succeeded'
  | 'setup_intent.setup_failed'

export interface WebhookEvent<T = unknown> {
  id: string
  type: WebhookEventType
  data: {
    object: T
    previousAttributes?: Partial<T>
  }
  created: number
  livemode: boolean
}

export interface WebhookHandlerResult {
  handled: boolean
  eventType: string
  error?: string
}

// =============================================================================
// Dispute Types
// =============================================================================

export interface DisputeOptions {
  dp_id?: string
  metadata?: Record<string, string>
  listOptions?: {
    charge?: string
    payment_intent?: string
    created?: string
    ending_before?: string
    limit?: number
    starting_after?: string
  }
}

// =============================================================================
// Event Types
// =============================================================================

export interface EventOptions {
  event_id?: string
  listOptions?: {
    created?: Record<string, unknown>
    delivery_success?: boolean
    ending_before?: string
    limit?: number
    starting_after?: string
    type?: string
  }
}

// =============================================================================
// Utility Types
// =============================================================================

export interface PaginatedResult<T> {
  data: T[]
  hasMore: boolean
  totalCount?: number
}

export interface AmountBreakdown {
  subtotal: number
  tax: number
  discount: number
  total: number
  currency: string
}
