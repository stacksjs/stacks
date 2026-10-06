import type {
  CheckoutRequest,
  CheckoutSession,
  Customer,
  Money,
  Payer,
  PaymentDriver,
  PaymentEvent,
  PaymentEventType,
  PaymentOperation,
  PaymentResult,
  RefundOptions,
  RefundResult,
  StoredPaymentMethod,
  SubscriptionStatus,
  SubscriptionSummary,
  WebhookRequest,
} from './types'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { assertMoney, headerOf, PaymentProviderError, PaymentUnsupportedError, WebhookNotConfiguredError, WebhookSignatureError } from './types'

/**
 * The Lemon Squeezy driver (stacksjs/stacks#536), on API v1.
 *
 * Lemon Squeezy is a merchant of record with a hosted checkout, and its API
 * is narrower than a processor's. The driver says where rather than
 * pretending:
 *
 *   - Every payment goes through the hosted checkout, and a checkout sells
 *     one variant. There is no server-side charge, no payment the browser
 *     completes on an SDK, and no stored payment methods to list
 *     (`charge`, `createPayment` and `paymentMethods` are unsupported).
 *   - A subscription starts at checkout, on a subscription variant
 *     (`subscribe` is unsupported), and cancelling one always runs to the end
 *     of the period it has paid for.
 *   - A line priced in the request (`name` and `unitAmount`) is sold as a
 *     custom price on one variant you set aside for it, in the store's own
 *     currency.
 *   - A refund is issued at once against the order, whole or in part.
 *   - The `order_refunded` webhook states the order's refunded total rather
 *     than the one refund, so it arrives as `refundedTotal`.
 *
 * Verified against Lemon Squeezy's API reference; not yet run against a live
 * store.
 */
export interface LemonSqueezyConfig {
  apiKey: string
  /** The store every checkout, customer and subscription belongs to. */
  storeId: string
  /** The signing secret of the store's webhook, which verifies deliveries. */
  webhookSecret?: string
  /** Create checkouts in test mode. */
  testMode?: boolean
  /**
   * The variant a line priced in the request is sold as, with the line's
   * amount as its custom price. Without one, checkout lines must name a
   * variant.
   */
  customPriceVariantId?: string
  /** The application's own URL; a success page must be on its origin. */
  appUrl?: string
}

export const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1'

const CAPABILITIES: ReadonlySet<PaymentOperation> = new Set<PaymentOperation>([
  'customers',
  'refund',
  'checkout',
  'subscriptions',
  'webhooks',
])

interface Resource<A> {
  type: string
  id: string
  attributes: A
}

interface CustomerAttributes {
  name?: string | null
  email: string
}

interface OrderAttributes {
  identifier?: string
  status: string
  currency: string
  total: number
  refunded?: boolean
  refunded_amount?: number
}

interface SubscriptionAttributes {
  status: string
  variant_id?: number | string
  variant_name?: string | null
  product_name?: string | null
  cancelled?: boolean
  renews_at?: string | null
  ends_at?: string | null
}

const SUBSCRIPTION_STATUSES: Record<string, SubscriptionStatus> = {
  on_trial: 'trialing',
  active: 'active',
  paused: 'paused',
  past_due: 'past_due',
  unpaid: 'unpaid',
  // Cancelled in Lemon Squeezy is a grace period: the subscription stays
  // valid until `ends_at`. That is an active subscription set to end, which
  // is how every other driver reports it.
  cancelled: 'active',
  expired: 'canceled',
}

/** A Lemon Squeezy subscription in our terms. */
export function summarizeLemonSqueezySubscription(subscription: Resource<SubscriptionAttributes>): SubscriptionSummary {
  const { attributes } = subscription
  const cancelled = attributes.status === 'cancelled' || attributes.cancelled === true
  const periodEnd = cancelled ? attributes.ends_at : attributes.renews_at
  return {
    id: String(subscription.id),
    status: SUBSCRIPTION_STATUSES[attributes.status] ?? 'unknown',
    price: attributes.variant_id !== undefined
      ? { id: String(attributes.variant_id), name: attributes.variant_name ?? attributes.product_name ?? null, amount: null, interval: null }
      : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    cancelAtPeriodEnd: cancelled && attributes.status !== 'expired',
    raw: subscription,
  }
}

/** HMAC-SHA256 of the raw body under the webhook's signing secret, hex: Lemon Squeezy's `X-Signature`. */
export function lemonSqueezySignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

export class LemonSqueezyDriver implements PaymentDriver {
  readonly name = 'lemonsqueezy'
  readonly capabilities = CAPABILITIES
  private readonly config: LemonSqueezyConfig
  private readonly fetch: typeof fetch
  private storeCurrency: Promise<string> | undefined

  constructor(config: LemonSqueezyConfig, options: { fetch?: typeof fetch } = {}) {
    if (!config.apiKey)
      throw new Error('The Lemon Squeezy payment driver needs an API key: set LEMONSQUEEZY_API_KEY or payment.lemonsqueezy.apiKey.')
    if (!config.storeId)
      throw new Error('The Lemon Squeezy payment driver needs a store: set LEMONSQUEEZY_STORE_ID or payment.lemonsqueezy.storeId.')
    this.config = config
    this.fetch = options.fetch ?? fetch
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: { body?: unknown, query?: Record<string, string> } = {},
  ): Promise<{ data: T, meta?: { page?: { lastPage?: number } } }> {
    const url = new URL(`${LEMONSQUEEZY_API_URL}${path}`)
    for (const [key, value] of Object.entries(options.query ?? {}))
      url.searchParams.set(key, value)

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Accept': 'application/vnd.api+json',
    }
    if (options.body !== undefined)
      headers['Content-Type'] = 'application/vnd.api+json'

    const response = await this.fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    const text = await response.text()
    const body = text ? JSON.parse(text) : {}
    if (!response.ok) {
      const error = (body as { errors?: Array<{ detail?: string, title?: string, code?: string }> }).errors?.[0]
      throw new PaymentProviderError('lemonsqueezy', response.status, error?.detail ?? error?.title ?? response.statusText, error?.code ?? null)
    }
    return body
  }

  /** Every page of a list, a hundred at a time. */
  private async list<A>(path: string, filters: Record<string, string>): Promise<Array<Resource<A>>> {
    const all: Array<Resource<A>> = []
    for (let page = 1; ; page++) {
      const result = await this.request<Array<Resource<A>>>('GET', path, { query: { ...filters, 'page[number]': String(page), 'page[size]': '100' } })
      all.push(...(result.data ?? []))
      if (page >= (result.meta?.page?.lastPage ?? 1))
        return all
    }
  }

  private store() {
    return { data: { type: 'stores', id: String(this.config.storeId) } }
  }

  /** Refuse a success page off the application's origin. */
  private assertReturnUrl(url: string, label: string): void {
    let target: URL
    try {
      target = new URL(url)
    }
    catch {
      throw new TypeError(`${label} is not a valid URL: ${url}`)
    }
    if (!this.config.appUrl)
      return
    const app = new URL(/^https?:\/\//.test(this.config.appUrl) ? this.config.appUrl : `https://${this.config.appUrl}`)
    if (target.origin !== app.origin)
      throw new TypeError(`${label} (${target.origin}) is not on the application's origin (${app.origin})`)
  }

  /** The store's currency, which every custom price is in. Read once. */
  private currency(): Promise<string> {
    this.storeCurrency ??= this.request<Resource<{ currency: string }>>('GET', `/stores/${encodeURIComponent(this.config.storeId)}`)
      .then(result => result.data.attributes.currency.toLowerCase())
    return this.storeCurrency
  }

  /**
   * The Lemon Squeezy customer for this payer, in the configured store.
   * Lemon Squeezy identifies a customer by email, so the payer needs one.
   */
  async customer(payer: Payer): Promise<Customer> {
    if (!payer.email)
      throw new TypeError('A Lemon Squeezy customer is identified by email: the payer has none.')

    const found = await this.request<Array<Resource<CustomerAttributes>>>('GET', '/customers', {
      query: { 'filter[store_id]': String(this.config.storeId), 'filter[email]': payer.email },
    })
    const existing = found.data?.[0]
    if (existing)
      return { id: String(existing.id), email: existing.attributes.email, name: existing.attributes.name ?? null }

    const created = await this.request<Resource<CustomerAttributes>>('POST', '/customers', {
      body: {
        data: {
          type: 'customers',
          attributes: { email: payer.email, name: payer.name || payer.email },
          relationships: { store: this.store() },
        },
      },
    })
    return { id: String(created.data.id), email: created.data.attributes.email, name: created.data.attributes.name ?? null }
  }

  async charge(): Promise<PaymentResult> {
    throw new PaymentUnsupportedError('lemonsqueezy', 'charge', 'Lemon Squeezy takes every payment on its hosted checkout: use checkout')
  }

  async createPayment(): Promise<PaymentResult> {
    throw new PaymentUnsupportedError('lemonsqueezy', 'createPayment', 'Lemon Squeezy takes every payment on its hosted checkout: use checkout')
  }

  /**
   * Refund an order: all of it, or `options.amount` of it. Lemon Squeezy
   * issues the refund at once. It keeps no separate refund record, so the
   * result is identified by the order and its refunded total.
   */
  async refund(paymentId: string, options: RefundOptions = {}): Promise<RefundResult> {
    const attributes: Record<string, number> = {}
    if (options.amount) {
      assertMoney(options.amount, 'refund amount')
      const order = await this.request<Resource<OrderAttributes>>('GET', `/orders/${encodeURIComponent(paymentId)}`)
      if (order.data.attributes.currency.toLowerCase() !== options.amount.currency.toLowerCase())
        throw new TypeError(`The refund is in ${options.amount.currency.toUpperCase()}, but the order is in ${order.data.attributes.currency.toUpperCase()}.`)
      attributes.amount = options.amount.amount
    }

    const result = await this.request<Resource<OrderAttributes>>('POST', `/orders/${encodeURIComponent(paymentId)}/refund`, {
      body: { data: { type: 'orders', id: String(paymentId), ...(options.amount ? { attributes } : {}) } },
    })
    const order = result.data.attributes
    return {
      id: `${paymentId}:refunded:${order.refunded_amount ?? 0}`,
      paymentId,
      status: 'succeeded',
      // A full refund does not restate how much it was.
      amount: options.amount ? { amount: options.amount.amount, currency: options.amount.currency.toLowerCase() } : null,
      raw: result.data,
    }
  }

  /**
   * A hosted checkout for one variant. A line naming a `price` is that
   * variant; a line priced here is sold as the custom-price variant, in the
   * store's currency.
   */
  async checkout(payer: Payer, request: CheckoutRequest): Promise<CheckoutSession> {
    if (request.mode === 'setup')
      throw new PaymentUnsupportedError('lemonsqueezy', 'setup checkout', 'Lemon Squeezy saves a payment method while taking a payment, never on its own')
    if (request.lines.length !== 1)
      throw new PaymentUnsupportedError('lemonsqueezy', `a checkout with ${request.lines.length} lines`, 'a Lemon Squeezy checkout sells one variant')
    if (request.cancelUrl && request.cancelUrl !== request.successUrl)
      throw new PaymentUnsupportedError('lemonsqueezy', 'a separate cancelUrl', 'the hosted checkout has no cancel page')
    if (request.trialDays)
      throw new PaymentUnsupportedError('lemonsqueezy', 'a checkout trial', 'a Lemon Squeezy trial is set on the subscription variant')
    // automaticTax needs no handling: as merchant of record, Lemon Squeezy always calculates the tax.
    this.assertReturnUrl(request.successUrl, 'successUrl')

    const line = request.lines[0]!
    if (!Number.isInteger(line.quantity) || line.quantity < 1)
      throw new TypeError(`A checkout line's quantity must be a positive whole number, got ${line.quantity}`)

    let variantId: string
    const attributes: Record<string, unknown> = {}
    const productOptions: Record<string, unknown> = { redirect_url: request.successUrl }

    if ('price' in line) {
      variantId = line.price
    }
    else {
      if (request.mode === 'subscription')
        throw new TypeError('A Lemon Squeezy subscription checkout needs a subscription variant: a line priced here has no billing interval.')
      if (!this.config.customPriceVariantId)
        throw new TypeError('A checkout line priced here needs a variant to sell it as: set LEMONSQUEEZY_VARIANT_ID or payment.lemonsqueezy.customPriceVariantId.')
      const currency = await this.currency()
      if (request.currency && request.currency.toLowerCase() !== currency)
        throw new TypeError(`The checkout is in ${request.currency.toUpperCase()}, but the Lemon Squeezy store sells in ${currency.toUpperCase()}.`)
      const total: Money = { amount: line.unitAmount * line.quantity, currency }
      assertMoney(total, 'checkout amount')
      variantId = this.config.customPriceVariantId
      // The custom price is the whole charge, so the line is sold once.
      attributes.custom_price = total.amount
      productOptions.name = line.quantity === 1 ? line.name : `${line.name} x ${line.quantity}`
    }

    const custom: Record<string, string> = {
      ...request.metadata,
      ...(request.reference ? { reference: request.reference } : {}),
      stacks_user_id: String(payer.id),
    }

    const checkoutData: Record<string, unknown> = { custom }
    if (payer.email)
      checkoutData.email = payer.email
    if (payer.name)
      checkoutData.name = payer.name
    if ('price' in line && line.quantity > 1)
      checkoutData.variant_quantities = [{ variant_id: Number(variantId), quantity: line.quantity }]

    const result = await this.request<Resource<{ url: string, expires_at: string | null }>>('POST', '/checkouts', {
      body: {
        data: {
          type: 'checkouts',
          attributes: {
            ...attributes,
            product_options: productOptions,
            checkout_options: { discount: request.allowPromotionCodes === true },
            checkout_data: checkoutData,
            ...(this.config.testMode ? { test_mode: true } : {}),
          },
          relationships: {
            store: this.store(),
            variant: { data: { type: 'variants', id: String(variantId) } },
          },
        },
      },
    })

    return {
      id: String(result.data.id),
      url: result.data.attributes.url,
      expiresAt: result.data.attributes.expires_at ? new Date(result.data.attributes.expires_at) : null,
      raw: result.data,
    }
  }

  async paymentMethods(): Promise<StoredPaymentMethod[]> {
    throw new PaymentUnsupportedError('lemonsqueezy', 'paymentMethods', 'Lemon Squeezy keeps the card on the subscription; send the payer to its update_payment_method URL')
  }

  async removePaymentMethod(): Promise<void> {
    throw new PaymentUnsupportedError('lemonsqueezy', 'removePaymentMethod', 'Lemon Squeezy keeps the card on the subscription; send the payer to its update_payment_method URL')
  }

  async subscribe(): Promise<SubscriptionSummary> {
    throw new PaymentUnsupportedError('lemonsqueezy', 'subscribe', 'a Lemon Squeezy subscription starts at checkout: use checkout with a subscription variant')
  }

  /**
   * Cancel a subscription. Lemon Squeezy always lets it run to the end of the
   * period paid for, so an immediate cancellation is refused rather than
   * quietly becoming a later one.
   */
  async cancelSubscription(subscriptionId: string, options: { atPeriodEnd?: boolean } = {}): Promise<SubscriptionSummary> {
    if (!options.atPeriodEnd)
      throw new PaymentUnsupportedError('lemonsqueezy', 'an immediate cancellation', 'Lemon Squeezy cancels at the end of the billing period: pass { atPeriodEnd: true }')
    const result = await this.request<Resource<SubscriptionAttributes>>('DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`)
    return summarizeLemonSqueezySubscription(result.data)
  }

  /** The payer's subscriptions in the configured store, found by their email. */
  async subscriptions(payer: Payer): Promise<SubscriptionSummary[]> {
    if (!payer.email)
      throw new TypeError('Lemon Squeezy finds a payer\'s subscriptions by email: the payer has none.')
    const subscriptions = await this.list<SubscriptionAttributes>('/subscriptions', {
      'filter[store_id]': String(this.config.storeId),
      'filter[user_email]': payer.email,
    })
    return subscriptions.map(summarizeLemonSqueezySubscription)
  }

  async verifyWebhook(request: WebhookRequest): Promise<PaymentEvent[]> {
    if (!this.config.webhookSecret)
      throw new WebhookNotConfiguredError('lemonsqueezy', 'Lemon Squeezy webhooks cannot be verified without the signing secret: set LEMONSQUEEZY_WEBHOOK_SECRET or payment.lemonsqueezy.webhookSecret.')

    const given = headerOf(request.headers, 'x-signature')
    if (!given)
      throw new WebhookSignatureError('lemonsqueezy', 'there is no X-Signature header')
    const expected = Buffer.from(lemonSqueezySignature(request.payload, this.config.webhookSecret))
    const actual = Buffer.from(given.trim())
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new WebhookSignatureError('lemonsqueezy', 'it is signed with another secret')

    let notification: { meta?: { event_name?: string, custom_data?: Record<string, unknown> | null }, data?: Resource<Record<string, any>> }
    try {
      notification = JSON.parse(request.payload)
    }
    catch {
      throw new WebhookSignatureError('lemonsqueezy', 'the body is not JSON')
    }
    // Lemon Squeezy puts no event id in a delivery. A retry resends the same
    // bytes, so a digest of them recognises one; a later event about the same
    // order or subscription carries new attributes and digests differently.
    const id = `${notification.meta?.event_name ?? 'unknown'}:${createHash('sha256').update(request.payload, 'utf8').digest('hex').slice(0, 32)}`
    return [this.translate(id, notification)]
  }

  private translate(id: string, notification: { meta?: { event_name?: string, custom_data?: Record<string, unknown> | null }, data?: Resource<Record<string, any>> }): PaymentEvent {
    const name = notification.meta?.event_name ?? ''
    const data = notification.data
    const attributes = data?.attributes ?? {}
    const reference = typeof notification.meta?.custom_data?.reference === 'string' ? notification.meta.custom_data.reference : null
    const money = (amount: unknown): Money | null =>
      typeof amount === 'number' && typeof attributes.currency === 'string' ? { amount, currency: attributes.currency.toLowerCase() } : null
    const base = {
      provider: this.name,
      id,
      providerType: name,
      reference: data?.id !== undefined ? String(data.id) : null,
      merchantReference: reference,
      raw: notification,
    }

    if (name === 'order_created') {
      const type: PaymentEventType = attributes.status === 'paid' ? 'payment.succeeded' : attributes.status === 'failed' ? 'payment.failed' : 'unknown'
      return { ...base, type, amount: money(attributes.total), reason: null }
    }

    if (name === 'order_refunded') {
      const refundedTotal = money(attributes.refunded_amount)
      return { ...base, type: 'refund.succeeded', amount: null, ...(refundedTotal ? { refundedTotal } : {}), reason: null }
    }

    const types: Record<string, PaymentEventType> = {
      subscription_created: 'subscription.created',
      subscription_updated: 'subscription.updated',
      // A cancelled subscription runs to the end of its period; it ends at `subscription_expired`.
      subscription_cancelled: 'subscription.updated',
      subscription_resumed: 'subscription.updated',
      subscription_paused: 'subscription.updated',
      subscription_unpaused: 'subscription.updated',
      subscription_expired: 'subscription.canceled',
      subscription_payment_success: 'invoice.paid',
      subscription_payment_recovered: 'invoice.paid',
      subscription_payment_failed: 'invoice.payment_failed',
    }
    const type = types[name] ?? 'unknown'
    return { ...base, type, amount: type.startsWith('invoice.') ? money(attributes.total) : null, reason: null }
  }

  /** Lemon Squeezy marks a delivery handled on a 200, and retries anything else. */
  acknowledgeWebhook(): Response {
    return new Response(null, { status: 200 })
  }
}
