/**
 * The provider-neutral payments contract (stacksjs/stacks#665, #450).
 *
 * `@stacksjs/payments` was Stripe's SDK with a facade on it: every function
 * returned a `Stripe.*` type, and `config.payment.driver` was read by nothing.
 * A `PaymentDriver` describes what an application needs from a payment
 * provider in the application's terms - money in minor units, statuses of our
 * own, events of our own - and each provider implements it.
 *
 * Providers are not the same kind of thing, and the interface does not
 * pretend otherwise. A driver lists what it can do in `capabilities`; calling
 * anything else throws a {@link PaymentUnsupportedError} naming the driver and
 * the operation, rather than a stack trace from an SDK the app never
 * installed or a result that only looks like success.
 */

/** An amount in the currency's minor unit (cents), never a float. */
export interface Money {
  amount: number
  /** ISO 4217, lower case. */
  currency: string
}

/** Who is paying, as the application knows them. Any Stacks user model fits. */
export interface Payer {
  id: number | string
  email?: string | null
  name?: string | null
  /** The Stripe customer id, when the user model has the column. */
  stripe_id?: string | null
  update?: (values: Record<string, unknown>) => Promise<unknown>
}

export type PaymentOperation =
  | 'customers'
  | 'charge'
  | 'createPayment'
  | 'refund'
  | 'checkout'
  | 'paymentMethods'
  | 'subscriptions'
  | 'webhooks'

export interface Customer {
  /** The provider's id for this payer: a Stripe customer, an Adyen shopper reference. */
  id: string
  email: string | null
  name: string | null
}

/**
 * Where a payment stands.
 *
 * `requires_action`: the payer has to do something - authenticate, be
 * redirected. `processing`: accepted, outcome not known yet (it arrives by
 * webhook). Only `succeeded`, `failed` and `canceled` are final.
 */
export type PaymentStatus = 'succeeded' | 'processing' | 'requires_action' | 'requires_payment_method' | 'failed' | 'canceled'

/**
 * What the browser needs to finish a payment on the provider's own client SDK.
 * Tagged by provider, because the SDKs differ: Stripe.js confirms a client
 * secret, Adyen's Drop-in mounts a session.
 */
export type ClientConfirmation =
  | { provider: 'stripe', clientSecret: string }
  | { provider: 'adyen', sessionId: string, sessionData: string }

export interface PaymentResult {
  /** The provider's reference: a Stripe PaymentIntent id, an Adyen pspReference or session id. */
  id: string
  status: PaymentStatus
  amount: Money
  /** Present when the browser must act: authenticate, or complete the payment on the provider's SDK. */
  clientConfirmation?: ClientConfirmation
  /** A page the payer must be sent to, when the provider asks for a redirect. */
  redirectUrl?: string
  /** The provider's reason, for a failed payment. */
  failureReason?: string
  /** The provider's own object, for anything this contract does not cover. */
  raw: unknown
}

export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled'

export interface RefundResult {
  id: string
  paymentId: string
  status: RefundStatus
  /** Null when the provider refunds the whole payment without restating the amount. */
  amount: Money | null
  raw: unknown
}

/** A line on a checkout: priced here, or a price the provider's catalog holds. */
export type CheckoutLine =
  | { name: string, unitAmount: number, quantity: number }
  | { price: string, quantity: number }

export interface CheckoutRequest {
  /** `payment` takes money now, `subscription` starts one, `setup` stores a payment method. */
  mode: 'payment' | 'subscription' | 'setup'
  lines: CheckoutLine[]
  currency?: string
  /** Where the payer lands after paying. */
  successUrl: string
  /** Where the payer lands after abandoning. Stripe only; Adyen returns to one URL. */
  cancelUrl?: string
  /** Your reference for this checkout, echoed back in its webhook. */
  reference?: string
  metadata?: Record<string, string>
}

export interface CheckoutSession {
  id: string
  /** The hosted page to send the payer to. */
  url: string
  expiresAt: Date | null
  raw: unknown
}

export interface StoredPaymentMethod {
  id: string
  type: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
  raw: unknown
}

/** `unknown`: a status the provider added after this driver was written; `raw` has it. */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid' | 'paused' | 'unknown'

export interface SubscriptionPrice {
  /** The provider's price id. */
  id: string
  /** What the price is called: its nickname, or its lookup key. */
  name: string | null
  amount: Money | null
  interval: 'day' | 'week' | 'month' | 'year' | null
}

export interface SubscriptionSummary {
  id: string
  status: SubscriptionStatus
  price: SubscriptionPrice | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  /** Present while the first payment needs the payer: confirm it in the browser. */
  clientConfirmation?: ClientConfirmation
  raw: unknown
}

export type PaymentEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.canceled'
  | 'refund.succeeded'
  | 'refund.failed'
  | 'checkout.completed'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'unknown'

/** A verified webhook notification, in our terms. */
export interface PaymentEvent {
  /** The driver that verified it (`stripe`, `adyen`); with `id`, the key for deduplicating retries. */
  provider: string
  /** The same on every retry of one notification, so a retry can be recognised. */
  id: string
  type: PaymentEventType
  /** The provider's own name for the event (`payment_intent.succeeded`, `AUTHORISATION`). */
  providerType: string
  /**
   * The payment this event is about - for a refund, the payment refunded, so
   * a refund finds the same order its payment did.
   */
  reference: string | null
  /** Your reference, when the event carries it. */
  merchantReference: string | null
  /**
   * For a refund, the amount of this one refund - never a running total, so a
   * second partial refund adds to the first. Otherwise the payment's amount.
   */
  amount: Money | null
  /** Why a payment or refund failed, in the provider's words. */
  reason: string | null
  raw: unknown
}

export interface WebhookRequest {
  /** The body exactly as received; signatures cover the bytes, not a re-serialisation. */
  payload: string
  headers: Headers | Record<string, string | undefined>
}

export interface ChargeOptions {
  /** Your reference for this payment. */
  reference?: string
  description?: string
  metadata?: Record<string, string>
  /** Collapse retries of the same logical charge. */
  idempotencyKey?: string
}

export interface CreatePaymentOptions extends ChargeOptions {
  /** Where an Adyen session returns the payer; Stripe does not need one. */
  returnUrl?: string
}

export interface RefundOptions {
  /** Part of the payment; omit to refund all of it. */
  amount?: Money
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  idempotencyKey?: string
}

export interface PaymentDriver {
  readonly name: string
  readonly capabilities: ReadonlySet<PaymentOperation>

  /** The provider's customer for this payer, created when there is none yet. */
  customer: (payer: Payer) => Promise<Customer>
  /** Charge a stored payment method, server side. */
  charge: (payer: Payer, amount: Money, paymentMethod: string, options?: ChargeOptions) => Promise<PaymentResult>
  /** Start a payment the browser completes on the provider's SDK. */
  createPayment: (payer: Payer, amount: Money, options?: CreatePaymentOptions) => Promise<PaymentResult>
  refund: (paymentId: string, options?: RefundOptions) => Promise<RefundResult>
  /** A hosted checkout page. */
  checkout: (payer: Payer, request: CheckoutRequest) => Promise<CheckoutSession>
  paymentMethods: (payer: Payer) => Promise<StoredPaymentMethod[]>
  removePaymentMethod: (payer: Payer, paymentMethodId: string) => Promise<void>
  subscribe: (payer: Payer, price: string, options?: { type?: string }) => Promise<SubscriptionSummary>
  cancelSubscription: (subscriptionId: string, options?: { atPeriodEnd?: boolean }) => Promise<SubscriptionSummary>
  subscriptions: (payer: Payer) => Promise<SubscriptionSummary[]>
  /** Verify a webhook delivery and translate it. Throws on a signature that does not verify. */
  verifyWebhook: (request: WebhookRequest) => Promise<PaymentEvent[]>
  /** The response the provider expects once a delivery has been handled. */
  acknowledgeWebhook: () => Response
}

/** An operation the configured provider cannot do. */
export class PaymentUnsupportedError extends Error {
  readonly driver: string
  readonly operation: string

  constructor(driver: string, operation: string, detail?: string) {
    super(`The ${driver} payment driver does not support ${operation}${detail ? `: ${detail}` : '.'}`)
    this.name = 'PaymentUnsupportedError'
    this.driver = driver
    this.operation = operation
  }
}

/** A provider rejected a request. Carries its status and code. */
export class PaymentProviderError extends Error {
  readonly driver: string
  readonly status: number
  readonly code: string | null

  constructor(driver: string, status: number, message: string, code: string | null = null) {
    super(`${driver} rejected the request (${status}${code ? ` ${code}` : ''}): ${message}`)
    this.name = 'PaymentProviderError'
    this.driver = driver
    this.status = status
    this.code = code
  }
}

/** A webhook delivery whose signature does not verify. */
export class WebhookSignatureError extends Error {
  constructor(driver: string, detail: string) {
    super(`The ${driver} webhook signature does not verify: ${detail}`)
    this.name = 'WebhookSignatureError'
  }
}

/** Read a header from either a `Headers` or a plain object, case-insensitively. */
export function headerOf(headers: WebhookRequest['headers'], name: string): string | null {
  if (typeof (headers as Headers).get === 'function')
    return (headers as Headers).get(name)
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers as Record<string, string | undefined>)) {
    if (key.toLowerCase() === wanted)
      return value ?? null
  }
  return null
}

/** Validate an amount before it reaches a provider: a positive whole number of minor units. */
export function assertMoney(money: Money, label = 'amount'): void {
  if (!Number.isInteger(money.amount) || money.amount < 0)
    throw new TypeError(`${label} must be a whole number of minor units (cents), got ${money.amount}`)
  if (!/^[a-z]{3}$/i.test(money.currency))
    throw new TypeError(`${label} currency must be an ISO 4217 code, got "${money.currency}"`)
}
