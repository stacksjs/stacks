import type Stripe from 'stripe'
import type {
  ChargeOptions,
  CheckoutRequest,
  CheckoutSession,
  CreatePaymentOptions,
  Customer,
  Money,
  Payer,
  PaymentDriver,
  PaymentEvent,
  PaymentEventType,
  PaymentOperation,
  PaymentResult,
  PaymentStatus,
  RefundOptions,
  RefundResult,
  RefundStatus,
  StoredPaymentMethod,
  SubscriptionPrice,
  SubscriptionStatus,
  SubscriptionSummary,
  WebhookRequest,
} from './types'
import { assertMoney, headerOf, WebhookNotConfiguredError, WebhookSignatureError } from './types'

/**
 * The Stripe calls the driver needs, separated from the mapping so the mapping
 * is testable without Stripe. The defaults delegate to the billable modules
 * Stacks already had, so a Stripe app keeps their idempotency keys,
 * same-origin redirect checks and `stripe_id` bookkeeping unchanged.
 */
export interface StripeOperations {
  customer: (payer: Payer) => Promise<Stripe.Customer>
  createIntent: (payer: Payer, params: Stripe.PaymentIntentCreateParams, idempotencyKey?: string) => Promise<Stripe.PaymentIntent>
  refund: (paymentIntentId: string, params: Stripe.RefundCreateParams & { idempotencyKey?: string }) => Promise<Stripe.Refund>
  createCheckout: (payer: Payer, params: Stripe.Checkout.SessionCreateParams) => Promise<Stripe.Checkout.Session>
  listPaymentMethods: (customerId: string) => Promise<Stripe.PaymentMethod[]>
  deletePaymentMethod: (payer: Payer, paymentMethodId: string) => Promise<unknown>
  subscribe: (payer: Payer, type: string, lookupKey: string) => Promise<Stripe.Subscription>
  cancelSubscription: (subscriptionId: string, atPeriodEnd: boolean) => Promise<Stripe.Subscription>
  listSubscriptions: (customerId: string) => Promise<Stripe.Subscription[]>
  /** `tolerance`: seconds of clock skew a signature may have; omitted, Stripe's default (300). */
  constructEvent: (payload: string, signature: string, secret: string, tolerance?: number) => Promise<Stripe.Event>
}

const CAPABILITIES: ReadonlySet<PaymentOperation> = new Set<PaymentOperation>([
  'customers',
  'charge',
  'createPayment',
  'refund',
  'checkout',
  'paymentMethods',
  'subscriptions',
  'webhooks',
])

/**
 * A PaymentIntent's status in our terms. `requires_capture` is authorised but
 * not yet captured - no money has moved - so it is still `processing`.
 */
export function stripePaymentStatus(intent: Pick<Stripe.PaymentIntent, 'status' | 'last_payment_error'>): PaymentStatus {
  switch (intent.status) {
    case 'succeeded':
      return 'succeeded'
    case 'canceled':
      return 'canceled'
    case 'requires_action':
      return 'requires_action'
    case 'processing':
    case 'requires_capture':
      return 'processing'
    default:
      // requires_payment_method after a decline carries the decline.
      return intent.last_payment_error ? 'failed' : 'requires_payment_method'
  }
}

/**
 * What one `charge.refunded` refunded. The charge carries the running total,
 * so a second partial refund would otherwise be counted as the first plus
 * itself; the event's `previous_attributes` holds the total before it.
 */
/**
 * Decimal places Stripe's `amount` has beyond (or short of) the ISO 4217
 * minor unit a {@link Money} is in, for the currencies where the two disagree
 * (https://docs.stripe.com/currencies): ISK and UGX are written as two-decimal
 * amounts though ISO gives them none (5 ISK is 500), and MGA is zero-decimal
 * though ISO gives it two. Every other currency's amounts are the same.
 */
const STRIPE_DECIMAL_SHIFT: Readonly<Record<string, number>> = { isk: 2, ugx: 2, mga: -2 }

/**
 * A {@link Money} as Stripe's `amount`. Throws for an amount Stripe cannot
 * express, such as a fraction of an ariary, rather than charging a rounded one.
 */
export function toStripeAmount(money: Money): number {
  const shift = STRIPE_DECIMAL_SHIFT[money.currency.toLowerCase()] ?? 0
  if (shift >= 0)
    return money.amount * 10 ** shift
  const divisor = 10 ** -shift
  if (money.amount % divisor !== 0)
    throw new TypeError(`Stripe charges whole ${money.currency.toUpperCase()} only, and ${money.amount} minor units is ${money.amount / divisor} ${money.currency.toUpperCase()}.`)
  return money.amount / divisor
}

/** Stripe's `amount` in `currency` as ISO 4217 minor units, the reverse of {@link toStripeAmount}. */
export function fromStripeAmount(amount: number, currency: string): Money {
  const shift = STRIPE_DECIMAL_SHIFT[currency.toLowerCase()] ?? 0
  // Stripe keeps the extra ISK and UGX decimals at 00, so this is exact.
  return { amount: shift >= 0 ? Math.round(amount / 10 ** shift) : amount * 10 ** -shift, currency }
}

export function refundedThisTime(charge: Record<string, any>, previous?: Record<string, any> | null): number | undefined {
  if (typeof charge.amount_refunded !== 'number')
    return undefined
  const before = typeof previous?.amount_refunded === 'number' ? previous.amount_refunded : 0
  return charge.amount_refunded - before
}

function refundStatus(status: string | null): RefundStatus {
  if (status === 'succeeded' || status === 'failed' || status === 'canceled')
    return status
  return 'pending'
}

const SUBSCRIPTION_STATUSES = new Set<string>(['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid', 'paused'])

function subscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'incomplete_expired')
    return 'canceled'
  return SUBSCRIPTION_STATUSES.has(status) ? status as SubscriptionStatus : 'unknown'
}

const INTERVALS = new Set<string>(['day', 'week', 'month', 'year'])

/**
 * When the current billing period ends, in Unix seconds.
 *
 * Read from the subscription's item: Stripe moved `current_period_end` there
 * in API 2025-03-31.basil, and the subscription no longer carries it. Reading
 * the subscription's own field left `ends_at` empty on every row stored since.
 */
export function subscriptionPeriodEnd(subscription: Stripe.Subscription): number | undefined {
  const item = subscription.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined
  const fromItem = item?.current_period_end
  if (typeof fromItem === 'number')
    return fromItem
  const legacy = (subscription as unknown as { current_period_end?: unknown }).current_period_end
  return typeof legacy === 'number' ? legacy : undefined
}

export function summarizeSubscription(subscription: Stripe.Subscription): SubscriptionSummary {
  const item = subscription.items?.data?.[0]
  const periodEnd = subscriptionPeriodEnd(subscription)
  const price = item?.price
  // The first invoice's confirmation secret, when it was expanded and the
  // subscription is still waiting on the payer (3-D Secure, a declined card).
  const invoice = subscription.latest_invoice
  const secret = invoice && typeof invoice === 'object' ? invoice.confirmation_secret?.client_secret : undefined
  return {
    id: subscription.id,
    status: subscriptionStatus(subscription.status),
    price: price
      ? {
          id: price.id,
          name: price.nickname ?? price.lookup_key ?? null,
          amount: typeof price.unit_amount === 'number' ? fromStripeAmount(price.unit_amount, price.currency) : null,
          interval: INTERVALS.has(price.recurring?.interval ?? '') ? price.recurring!.interval as SubscriptionPrice['interval'] : null,
        }
      : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    ...(secret && subscription.status === 'incomplete' ? { clientConfirmation: { provider: 'stripe' as const, clientSecret: secret } } : {}),
    raw: subscription,
  }
}

const EVENT_TYPES: Record<string, PaymentEventType> = {
  'payment_intent.succeeded': 'payment.succeeded',
  'payment_intent.payment_failed': 'payment.failed',
  'payment_intent.canceled': 'payment.canceled',
  'charge.refunded': 'refund.succeeded',
  'refund.failed': 'refund.failed',
  'checkout.session.completed': 'checkout.completed',
  'customer.subscription.created': 'subscription.created',
  'customer.subscription.updated': 'subscription.updated',
  'customer.subscription.deleted': 'subscription.canceled',
  'invoice.paid': 'invoice.paid',
  'invoice.payment_failed': 'invoice.payment_failed',
}

/** A Stripe PaymentMethod in our terms. */
export function toStoredPaymentMethod(method: Stripe.PaymentMethod, defaultId: string | null = null): StoredPaymentMethod {
  return {
    id: method.id,
    type: method.type,
    brand: method.card?.brand ?? null,
    last4: method.card?.last4 ?? null,
    expMonth: method.card?.exp_month ?? null,
    expYear: method.card?.exp_year ?? null,
    isDefault: method.id === defaultId,
    raw: method,
  }
}

function toPayment(intent: Stripe.PaymentIntent): PaymentResult {
  const status = stripePaymentStatus(intent)
  return {
    id: intent.id,
    status,
    amount: fromStripeAmount(intent.amount, intent.currency),
    ...(intent.client_secret && (status === 'requires_payment_method' || status === 'requires_action')
      ? { clientConfirmation: { provider: 'stripe' as const, clientSecret: intent.client_secret } }
      : {}),
    ...(intent.next_action?.redirect_to_url?.url ? { redirectUrl: intent.next_action.redirect_to_url.url } : {}),
    ...(intent.last_payment_error?.message ? { failureReason: intent.last_payment_error.message } : {}),
    raw: intent,
  }
}

export interface StripeDriverOptions {
  operations: StripeOperations
  /** The account webhook's signing secret. */
  webhookSecret?: string
  /** Seconds of clock skew a webhook signature may have. Defaults to Stripe's 300. */
  webhookTolerance?: number
}

export class StripeDriver implements PaymentDriver {
  readonly name = 'stripe'
  readonly capabilities = CAPABILITIES
  private readonly ops: StripeOperations
  private readonly webhookSecret?: string
  private readonly webhookTolerance?: number

  constructor(options: StripeDriverOptions) {
    this.ops = options.operations
    this.webhookSecret = options.webhookSecret
    this.webhookTolerance = options.webhookTolerance
  }

  async customer(payer: Payer): Promise<Customer> {
    const customer = await this.ops.customer(payer)
    return { id: customer.id, email: customer.email ?? null, name: customer.name ?? null }
  }

  async charge(payer: Payer, amount: Money, paymentMethod: string, options: ChargeOptions = {}): Promise<PaymentResult> {
    assertMoney(amount)
    const customer = await this.ops.customer(payer)
    const intent = await this.ops.createIntent(payer, {
      amount: toStripeAmount(amount),
      currency: amount.currency.toLowerCase(),
      customer: customer.id,
      payment_method: paymentMethod,
      confirm: true,
      // A server-side charge has no page to redirect back to.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      off_session: true,
      ...(options.description ? { description: options.description } : {}),
      metadata: { ...options.metadata, ...(options.reference ? { reference: options.reference } : {}) },
    }, options.idempotencyKey)
    return toPayment(intent)
  }

  async createPayment(payer: Payer, amount: Money, options: CreatePaymentOptions = {}): Promise<PaymentResult> {
    assertMoney(amount)
    const customer = await this.ops.customer(payer)
    const intent = await this.ops.createIntent(payer, {
      amount: toStripeAmount(amount),
      currency: amount.currency.toLowerCase(),
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
      ...(options.description ? { description: options.description } : {}),
      metadata: { ...options.metadata, ...(options.reference ? { reference: options.reference } : {}) },
    }, options.idempotencyKey)
    return toPayment(intent)
  }

  async refund(paymentId: string, options: RefundOptions = {}): Promise<RefundResult> {
    if (options.amount)
      assertMoney(options.amount, 'refund amount')
    const refund = await this.ops.refund(paymentId, {
      ...(options.amount ? { amount: toStripeAmount(options.amount) } : {}),
      ...(options.reason ? { reason: options.reason } : {}),
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    })
    return {
      id: refund.id,
      paymentId,
      status: refundStatus(refund.status),
      amount: fromStripeAmount(refund.amount, refund.currency),
      raw: refund,
    }
  }

  async checkout(payer: Payer, request: CheckoutRequest): Promise<CheckoutSession> {
    if (request.trialDays !== undefined && (!Number.isSafeInteger(request.trialDays) || request.trialDays < 1))
      throw new TypeError('trialDays is a whole number of days, at least 1.')
    if (request.trialDays && request.mode !== 'subscription')
      throw new TypeError('trialDays applies to a subscription checkout.')
    const customer = await this.ops.customer(payer)
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = request.lines.map((line) => {
      if ('price' in line)
        return { price: line.price, quantity: line.quantity }
      if (!request.currency)
        throw new TypeError('A checkout line priced with unitAmount needs the checkout\'s currency.')
      return {
        quantity: line.quantity,
        price_data: { currency: request.currency.toLowerCase(), unit_amount: toStripeAmount({ amount: line.unitAmount, currency: request.currency }), product_data: { name: line.name } },
      }
    })

    // A session's metadata stays on the session. The payment or subscription
    // it creates carries its own, which is what their later webhooks read, so
    // the reference and metadata are copied there too.
    const carried = { ...request.metadata, ...(request.reference ? { reference: request.reference } : {}) }
    const hasCarried = Object.keys(carried).length > 0

    const session = await this.ops.createCheckout(payer, {
      customer: customer.id,
      mode: request.mode,
      success_url: request.successUrl,
      ...(request.cancelUrl ? { cancel_url: request.cancelUrl } : {}),
      ...(request.mode === 'setup' ? { currency: request.currency?.toLowerCase() } : { line_items: lineItems }),
      ...(request.reference ? { client_reference_id: request.reference } : {}),
      ...(request.metadata ? { metadata: request.metadata } : {}),
      ...(hasCarried && request.mode === 'payment' ? { payment_intent_data: { metadata: carried } } : {}),
      ...(request.mode === 'subscription' && (hasCarried || request.trialDays)
        ? { subscription_data: { ...(hasCarried ? { metadata: carried } : {}), ...(request.trialDays ? { trial_period_days: request.trialDays } : {}) } }
        : {}),
      ...(hasCarried && request.mode === 'setup' ? { setup_intent_data: { metadata: carried } } : {}),
      ...(request.allowPromotionCodes ? { allow_promotion_codes: true } : {}),
      ...(request.automaticTax ? { automatic_tax: { enabled: true } } : {}),
      ...(request.paymentMethods?.length ? { allowed_payment_method_types: [...request.paymentMethods] as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[] } : {}),
    })

    if (!session.url)
      throw new Error('Stripe returned a checkout session without a url.')
    return { id: session.id, url: session.url, expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null, raw: session }
  }

  async paymentMethods(payer: Payer): Promise<StoredPaymentMethod[]> {
    const customer = await this.ops.customer(payer)
    const defaultId = typeof customer.invoice_settings?.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings?.default_payment_method?.id ?? null
    const methods = await this.ops.listPaymentMethods(customer.id)
    return methods.map(method => toStoredPaymentMethod(method, defaultId))
  }

  async removePaymentMethod(payer: Payer, paymentMethodId: string): Promise<void> {
    await this.ops.deletePaymentMethod(payer, paymentMethodId)
  }

  async subscribe(payer: Payer, price: string, options: { type?: string } = {}): Promise<SubscriptionSummary> {
    return summarizeSubscription(await this.ops.subscribe(payer, options.type ?? 'default', price))
  }

  async cancelSubscription(subscriptionId: string, options: { atPeriodEnd?: boolean } = {}): Promise<SubscriptionSummary> {
    return summarizeSubscription(await this.ops.cancelSubscription(subscriptionId, options.atPeriodEnd ?? false))
  }

  async subscriptions(payer: Payer): Promise<SubscriptionSummary[]> {
    const customer = await this.ops.customer(payer)
    return (await this.ops.listSubscriptions(customer.id)).map(summarizeSubscription)
  }

  async verifyWebhook(request: WebhookRequest): Promise<PaymentEvent[]> {
    if (!this.webhookSecret)
      throw new WebhookNotConfiguredError('stripe', 'Stripe webhooks cannot be verified without the signing secret: set STRIPE_WEBHOOK_SECRET or payment.stripe.webhookSecret.')
    const signature = headerOf(request.headers, 'stripe-signature')
    if (!signature)
      throw new WebhookSignatureError('stripe', 'there is no Stripe-Signature header')

    let event: Stripe.Event
    try {
      event = await this.ops.constructEvent(request.payload, signature, this.webhookSecret, this.webhookTolerance)
    }
    catch (error) {
      throw new WebhookSignatureError('stripe', (error as Error).message)
    }

    const object = event.data.object as unknown as Record<string, any>
    // A charge or refund names the payment it belongs to; the event is about that payment.
    const isRefund = event.type === 'charge.refunded' || event.type === 'refund.failed'
    const reference = isRefund ? object.payment_intent ?? object.id : object.id
    const minor = event.type === 'charge.refunded' ? refundedThisTime(object, event.data.previous_attributes) : object.amount ?? object.amount_total
    const amount = typeof minor === 'number' && object.currency ? fromStripeAmount(minor, String(object.currency)) : null
    const reason = object.last_payment_error?.message ?? object.failure_reason ?? null
    return [{
      provider: this.name,
      id: event.id,
      type: EVENT_TYPES[event.type] ?? 'unknown',
      providerType: event.type,
      reference: typeof reference === 'string' ? reference : null,
      merchantReference: object.client_reference_id ?? object.metadata?.reference ?? null,
      amount,
      reason,
      raw: event,
    }]
  }

  acknowledgeWebhook(): Response {
    return Response.json({ received: true })
  }
}
