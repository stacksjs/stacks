import type {
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
  RefundOptions,
  RefundResult,
  RefundStatus,
  StoredPaymentMethod,
  SubscriptionStatus,
  SubscriptionSummary,
  WebhookRequest,
} from './types'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { assertMoney, headerOf, PaymentProviderError, PaymentUnsupportedError, WebhookNotConfiguredError, WebhookSignatureError } from './types'

/**
 * The Paddle Billing driver (stacksjs/stacks#665), on API version 1.
 *
 * Paddle is a merchant of record, not a processor: it is the seller, it
 * charges and remits the tax, and it owns refunds. That shows in the API, and
 * this driver says so rather than papering over it:
 *
 *   - Every payment is a transaction the payer completes in Paddle.js. There
 *     is no server-side charge of a stored card (`charge` is unsupported), and
 *     a subscription starts at checkout, never from the server (`subscribe`
 *     is unsupported; checkout in `subscription` mode with recurring prices).
 *   - A refund is a request: Paddle reviews it, so it comes back `pending`,
 *     and the outcome arrives as an `adjustment.updated` webhook.
 *   - Checkout is not a Paddle-hosted page. A transaction's payment link is
 *     your own approved page, which loads Paddle.js and opens the checkout.
 *     Stacks serves that page at `GET /payments/checkout`; set it as the
 *     default payment link in Paddle.
 *   - Tax is always Paddle's: amounts priced in a request are tax-inclusive
 *     (`tax_mode: internal`), so the payer pays exactly what the request says.
 *
 * Verified against Paddle's API reference and its signature-verification
 * reference implementation; not yet run against a live Paddle account.
 */
export interface PaddleConfig {
  /** An API key: `pdl_sdbx_apikey_...` for sandbox, `pdl_live_apikey_...` for live. */
  apiKey: string
  environment: 'sandbox' | 'live'
  /** The notification destination's secret key, which verifies webhooks. */
  webhookSecret?: string
  /** A client-side token, for Paddle.js on the checkout page. */
  clientToken?: string
  /**
   * The tax category for lines priced in a request (`name` and `unitAmount`).
   * It must be enabled on your Paddle account. Defaults to `standard`.
   */
  taxCategory?: string
  /**
   * How old a webhook's signed timestamp may be, in seconds. Paddle's own
   * SDKs allow five.
   */
  webhookTolerance?: number
  /** The application's own URL; a success page must be on its origin. */
  appUrl?: string
}

export const PADDLE_API_VERSION = '1'

const CAPABILITIES: ReadonlySet<PaymentOperation> = new Set<PaymentOperation>([
  'customers',
  'createPayment',
  'refund',
  'checkout',
  'paymentMethods',
  'subscriptions',
  'webhooks',
])

/** The transaction custom_data key the checkout page reads its success page from. */
export const PADDLE_SUCCESS_URL_KEY = 'stacks_success_url'

const TRANSACTION_ID = /^txn_[a-z\d]{26}$/
const CUSTOMER_ID_IN_DETAIL = /ctm_[a-z\d]{26}/

/** A Paddle adjustment's status in our terms. */
export function paddleRefundStatus(status: string | undefined): RefundStatus {
  switch (status) {
    case 'approved':
      return 'succeeded'
    case 'rejected':
      return 'failed'
    case 'reversed':
      return 'canceled'
    default:
      // pending_approval: Paddle reviews most live refunds.
      return 'pending'
  }
}

const SUBSCRIPTION_STATUSES = new Set<string>(['active', 'trialing', 'past_due', 'paused', 'canceled'])

interface PaddlePrice {
  id: string
  name?: string | null
  description?: string
  unit_price?: { amount: string, currency_code: string }
  billing_cycle?: { interval: string, frequency: number } | null
}

interface PaddleSubscription {
  id: string
  status: string
  current_billing_period?: { starts_at: string, ends_at: string } | null
  scheduled_change?: { action: string, effective_at: string } | null
  items?: Array<{ price?: PaddlePrice, quantity?: number }>
}

const INTERVALS = new Set(['day', 'week', 'month', 'year'])

/** A Paddle subscription in our terms. */
export function summarizePaddleSubscription(subscription: PaddleSubscription): SubscriptionSummary {
  const price = subscription.items?.[0]?.price
  const interval = price?.billing_cycle?.interval
  return {
    id: subscription.id,
    status: SUBSCRIPTION_STATUSES.has(subscription.status) ? subscription.status as SubscriptionStatus : 'unknown',
    price: price
      ? {
          id: price.id,
          name: price.name ?? price.description ?? null,
          amount: price.unit_price ? { amount: Number(price.unit_price.amount), currency: price.unit_price.currency_code.toLowerCase() } : null,
          interval: interval && INTERVALS.has(interval) ? interval as 'day' | 'week' | 'month' | 'year' : null,
        }
      : null,
    currentPeriodEnd: subscription.current_billing_period?.ends_at ? new Date(subscription.current_billing_period.ends_at) : null,
    cancelAtPeriodEnd: subscription.scheduled_change?.action === 'cancel',
    raw: subscription,
  }
}

/**
 * A `Paddle-Signature` header: `ts=<unix seconds>;h1=<hex>`, with more than
 * one `h1` while Paddle rotates a secret.
 */
export function parsePaddleSignature(header: string): { timestamp: number, signatures: string[] } | null {
  let timestamp: number | null = null
  const signatures: string[] = []
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1)
      continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key === 'ts' && /^\d+$/.test(value))
      timestamp = Number(value)
    else if (key === 'h1' && value)
      signatures.push(value)
  }
  return timestamp === null || signatures.length === 0 ? null : { timestamp, signatures }
}

/** HMAC-SHA256 of `<ts>:<raw body>` under the secret key, hex, as Paddle signs a webhook. */
export function paddleSignature(timestamp: number, payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}:${payload}`, 'utf8').digest('hex')
}

interface PaddleTransaction {
  id: string
  status: string
  customer_id?: string | null
  currency_code?: string
  custom_data?: Record<string, unknown> | null
  checkout?: { url: string | null } | null
  details?: {
    totals?: { grand_total?: string, currency_code?: string }
    line_items?: Array<{ id: string, totals?: { total?: string } }>
  }
  payments?: Array<{ status?: string, error_code?: string | null }>
}

interface PaddleAdjustment {
  id: string
  action: string
  transaction_id: string
  status: string
  reason?: string
  currency_code?: string
  totals?: { total?: string, currency_code?: string }
}

interface PaddleCustomer {
  id: string
  email: string
  name?: string | null
}

export class PaddleDriver implements PaymentDriver {
  readonly name = 'paddle'
  readonly capabilities = CAPABILITIES
  private readonly config: PaddleConfig
  private readonly fetch: typeof fetch
  private readonly now: () => number

  constructor(config: PaddleConfig, options: { fetch?: typeof fetch, now?: () => number } = {}) {
    if (!config.apiKey)
      throw new Error('The Paddle payment driver needs an API key: set PADDLE_API_KEY or payment.paddle.apiKey.')
    // A key works only in its own environment, and the mismatch otherwise
    // surfaces as a bare 403 on the first request.
    const keyEnvironment = config.apiKey.startsWith('pdl_live_') ? 'live' : config.apiKey.startsWith('pdl_sdbx_') ? 'sandbox' : null
    if (keyEnvironment && keyEnvironment !== config.environment)
      throw new Error(`The Paddle API key is a ${keyEnvironment} key, but payment.paddle.environment is ${config.environment}.`)
    this.config = config
    this.fetch = options.fetch ?? fetch
    this.now = options.now ?? Date.now
  }

  get environment(): 'sandbox' | 'live' {
    return this.config.environment
  }

  /** The client-side token Paddle.js authenticates with, when one is set. */
  get clientToken(): string | undefined {
    return this.config.clientToken || undefined
  }

  /** The API base for this environment. */
  get baseUrl(): string {
    return this.config.environment === 'live' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: { body?: unknown, query?: Record<string, string> } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(options.query ?? {}))
      url.searchParams.set(key, value)

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Paddle-Version': PADDLE_API_VERSION,
      'Accept': 'application/json',
    }
    if (options.body !== undefined)
      headers['Content-Type'] = 'application/json'

    const response = await this.fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    if (response.status === 204)
      return undefined as T
    const text = await response.text()
    const body = text ? JSON.parse(text) : undefined
    if (!response.ok) {
      const error = (body as { error?: { code?: string, detail?: string } } | undefined)?.error
      throw new PaymentProviderError('paddle', response.status, error?.detail ?? response.statusText, error?.code ?? null)
    }
    return (body as { data: T }).data
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

  /** A line priced in the request: a non-catalog price, tax included. */
  private pricedLine(name: string, amount: Money, quantity: number) {
    assertMoney(amount)
    return {
      quantity,
      price: {
        description: name.length >= 2 ? name : `${name} `.padEnd(2, ' '),
        name,
        tax_mode: 'internal',
        unit_price: { amount: String(amount.amount), currency_code: amount.currency.toUpperCase() },
        product: { name, tax_category: this.config.taxCategory ?? 'standard' },
      },
    }
  }

  /**
   * The Paddle customer for this payer. Paddle identifies a customer by
   * email, one per address, so the payer must have one: found by it, or
   * created with it.
   */
  async customer(payer: Payer): Promise<Customer> {
    if (!payer.email)
      throw new TypeError('A Paddle customer is identified by email: the payer has none.')

    const found = await this.request<PaddleCustomer[]>('GET', '/customers', { query: { email: payer.email } })
    if (found?.[0])
      return { id: found[0].id, email: found[0].email, name: found[0].name ?? null }

    try {
      const created = await this.request<PaddleCustomer>('POST', '/customers', {
        body: { email: payer.email, ...(payer.name ? { name: payer.name } : {}), custom_data: { stacks_user_id: String(payer.id) } },
      })
      return { id: created.id, email: created.email, name: created.name ?? null }
    }
    catch (error) {
      // Created between the lookup and the create: Paddle names the customer
      // that holds the address in the error's detail.
      const existing = error instanceof PaymentProviderError && error.code === 'customer_already_exists'
        ? CUSTOMER_ID_IN_DETAIL.exec(error.message)?.[0]
        : undefined
      if (!existing)
        throw error
      const customer = await this.request<PaddleCustomer>('GET', `/customers/${existing}`)
      return { id: customer.id, email: customer.email, name: customer.name ?? null }
    }
  }

  async charge(): Promise<PaymentResult> {
    throw new PaymentUnsupportedError('paddle', 'charge', 'Paddle takes every payment through its checkout; open one with createPayment or checkout')
  }

  /**
   * A transaction the payer completes in Paddle.js. `returnUrl` is where the
   * checkout sends them after paying; it travels in the confirmation, because
   * Paddle takes it in the browser.
   */
  async createPayment(payer: Payer, amount: Money, options: CreatePaymentOptions = {}): Promise<PaymentResult> {
    if (options.returnUrl)
      this.assertReturnUrl(options.returnUrl, 'returnUrl')
    const customer = await this.customer(payer)
    const transaction = await this.request<PaddleTransaction>('POST', '/transactions', {
      body: {
        items: [this.pricedLine(options.description ?? 'Payment', amount, 1)],
        customer_id: customer.id,
        currency_code: amount.currency.toUpperCase(),
        collection_mode: 'automatic',
        custom_data: { ...options.metadata, ...(options.reference ? { reference: options.reference } : {}) },
      },
    })

    return {
      id: transaction.id,
      status: 'requires_payment_method',
      amount: { amount: amount.amount, currency: amount.currency.toLowerCase() },
      clientConfirmation: { provider: 'paddle', transactionId: transaction.id, ...(options.returnUrl ? { successUrl: options.returnUrl } : {}) },
      raw: transaction,
    }
  }

  /**
   * Refund a transaction: all of it, or `options.amount` of it. A partial
   * amount is taken from the transaction's line items in order, tax
   * included. Paddle reviews most live refunds, so the result is `pending`
   * until an `adjustment.updated` webhook settles it.
   */
  async refund(paymentId: string, options: RefundOptions = {}): Promise<RefundResult> {
    const reason = options.reason ?? 'requested_by_customer'
    let body: Record<string, unknown> = { action: 'refund', transaction_id: paymentId, reason, type: 'full' }

    if (options.amount) {
      assertMoney(options.amount, 'refund amount')
      const transaction = await this.request<PaddleTransaction>('GET', `/transactions/${encodeURIComponent(paymentId)}`)
      const currency = (transaction.details?.totals?.currency_code ?? transaction.currency_code ?? '').toLowerCase()
      if (currency && currency !== options.amount.currency.toLowerCase())
        throw new TypeError(`The refund is in ${options.amount.currency.toUpperCase()}, but the transaction is in ${currency.toUpperCase()}.`)

      const items: Array<{ item_id: string, type: 'full' | 'partial', amount?: string }> = []
      let left = options.amount.amount
      for (const line of transaction.details?.line_items ?? []) {
        if (left <= 0)
          break
        const total = Number(line.totals?.total ?? 0)
        if (total <= 0)
          continue
        const take = Math.min(left, total)
        items.push(take === total ? { item_id: line.id, type: 'full' } : { item_id: line.id, type: 'partial', amount: String(take) })
        left -= take
      }
      if (left > 0)
        throw new TypeError(`The refund of ${options.amount.amount} is more than the transaction's ${options.amount.amount - left}.`)
      body = { action: 'refund', transaction_id: paymentId, reason, type: 'partial', tax_mode: 'internal', items }
    }

    const adjustment = await this.request<PaddleAdjustment>('POST', '/adjustments', { body })
    const total = adjustment.totals?.total
    const currency = adjustment.totals?.currency_code ?? adjustment.currency_code
    return {
      id: adjustment.id,
      paymentId,
      status: paddleRefundStatus(adjustment.status),
      amount: total !== undefined && currency ? { amount: Number(total), currency: currency.toLowerCase() } : null,
      raw: adjustment,
    }
  }

  /**
   * A transaction and its payment link. The link opens your default payment
   * link page (`GET /payments/checkout`), which reads the success page from
   * the transaction and opens Paddle.js.
   */
  async checkout(payer: Payer, request: CheckoutRequest): Promise<CheckoutSession> {
    if (request.mode === 'setup')
      throw new PaymentUnsupportedError('paddle', 'setup checkout', 'Paddle saves a payment method while taking a payment, never on its own')
    if (request.cancelUrl && request.cancelUrl !== request.successUrl)
      throw new PaymentUnsupportedError('paddle', 'a separate cancelUrl', 'Paddle checkout opens over your page, and closing it leaves the payer there')
    if (request.allowPromotionCodes)
      throw new PaymentUnsupportedError('paddle', 'promotion codes', 'whether the discount field shows is a Paddle checkout setting, not a per-checkout option')
    if (request.trialDays)
      throw new PaymentUnsupportedError('paddle', 'a checkout trial', 'a Paddle trial is part of the price: set its trial period on the price')
    // automaticTax needs no handling: Paddle, as merchant of record, always calculates the tax.
    this.assertReturnUrl(request.successUrl, 'successUrl')

    const items = request.lines.map((line) => {
      if ('price' in line)
        return { price_id: line.price, quantity: line.quantity }
      if (request.mode === 'subscription')
        throw new TypeError('A Paddle subscription checkout needs catalog prices (pri_...) with a billing cycle: a line priced here has none.')
      if (!request.currency)
        throw new TypeError('A checkout line priced with unitAmount needs the checkout\'s currency.')
      return this.pricedLine(line.name, { amount: line.unitAmount, currency: request.currency }, line.quantity)
    })

    const customer = await this.customer(payer)
    const transaction = await this.request<PaddleTransaction>('POST', '/transactions', {
      body: {
        items,
        customer_id: customer.id,
        ...(request.currency ? { currency_code: request.currency.toUpperCase() } : {}),
        collection_mode: 'automatic',
        custom_data: {
          ...request.metadata,
          ...(request.reference ? { reference: request.reference } : {}),
          [PADDLE_SUCCESS_URL_KEY]: request.successUrl,
        },
        // Your default payment link, with this transaction appended.
        checkout: { url: null },
      },
    })

    if (!transaction.checkout?.url)
      throw new Error('Paddle returned no payment link: set a default payment link in Paddle (Checkout > Checkout settings), pointing at /payments/checkout.')
    return { id: transaction.id, url: transaction.checkout.url, expiresAt: null, raw: transaction }
  }

  /**
   * What the checkout page needs to open a transaction: the success page it
   * was created with, re-checked against the application's origin. Null when
   * it has none, as a payment-method update transaction from Paddle does.
   */
  async checkoutSuccessUrl(transactionId: string): Promise<string | null> {
    if (!TRANSACTION_ID.test(transactionId))
      throw new TypeError('Not a Paddle transaction id.')
    const transaction = await this.request<PaddleTransaction>('GET', `/transactions/${transactionId}`)
    const successUrl = transaction.custom_data?.[PADDLE_SUCCESS_URL_KEY]
    if (typeof successUrl !== 'string')
      return null
    this.assertReturnUrl(successUrl, 'successUrl')
    return successUrl
  }

  async paymentMethods(payer: Payer): Promise<StoredPaymentMethod[]> {
    const customer = await this.customer(payer)
    const methods = await this.request<Array<{
      id: string
      type: string
      card?: { type?: string, last4?: string, expiry_month?: number, expiry_year?: number } | null
    }>>('GET', `/customers/${customer.id}/payment-methods`)
    // Paddle has no default payment method: a subscription keeps its own.
    return (methods ?? []).map(method => ({
      id: method.id,
      type: method.type,
      brand: method.card?.type ?? null,
      last4: method.card?.last4 ?? null,
      expMonth: method.card?.expiry_month ?? null,
      expYear: method.card?.expiry_year ?? null,
      isDefault: false,
      raw: method,
    }))
  }

  async removePaymentMethod(payer: Payer, paymentMethodId: string): Promise<void> {
    const customer = await this.customer(payer)
    await this.request<void>('DELETE', `/customers/${customer.id}/payment-methods/${encodeURIComponent(paymentMethodId)}`)
  }

  async subscribe(): Promise<SubscriptionSummary> {
    throw new PaymentUnsupportedError('paddle', 'subscribe', 'a Paddle subscription starts at checkout: use checkout with mode "subscription"')
  }

  async cancelSubscription(subscriptionId: string, options: { atPeriodEnd?: boolean } = {}): Promise<SubscriptionSummary> {
    const subscription = await this.request<PaddleSubscription>('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      body: { effective_from: options.atPeriodEnd ? 'next_billing_period' : 'immediately' },
    })
    return summarizePaddleSubscription(subscription)
  }

  async subscriptions(payer: Payer): Promise<SubscriptionSummary[]> {
    const customer = await this.customer(payer)
    const subscriptions = await this.request<PaddleSubscription[]>('GET', '/subscriptions', { query: { customer_id: customer.id } })
    return (subscriptions ?? []).map(summarizePaddleSubscription)
  }

  async verifyWebhook(request: WebhookRequest): Promise<PaymentEvent[]> {
    if (!this.config.webhookSecret)
      throw new WebhookNotConfiguredError('paddle', 'Paddle webhooks cannot be verified without the endpoint secret key: set PADDLE_WEBHOOK_SECRET or payment.paddle.webhookSecret.')

    const header = headerOf(request.headers, 'paddle-signature')
    if (!header)
      throw new WebhookSignatureError('paddle', 'there is no Paddle-Signature header')
    const signature = parsePaddleSignature(header)
    if (!signature)
      throw new WebhookSignatureError('paddle', 'the Paddle-Signature header is not ts=...;h1=...')

    const tolerance = this.config.webhookTolerance ?? 5
    if (Math.abs(this.now() / 1000 - signature.timestamp) > tolerance)
      throw new WebhookSignatureError('paddle', `the signature is more than ${tolerance} seconds from now`)

    const expected = Buffer.from(paddleSignature(signature.timestamp, request.payload, this.config.webhookSecret))
    // More than one h1 during a secret rotation: any of them may match.
    const matches = signature.signatures.some((given) => {
      const actual = Buffer.from(given)
      return actual.length === expected.length && timingSafeEqual(actual, expected)
    })
    if (!matches)
      throw new WebhookSignatureError('paddle', 'it is signed with another key')

    let notification: { event_id: string, event_type: string, data: Record<string, any> }
    try {
      notification = JSON.parse(request.payload)
    }
    catch {
      throw new WebhookSignatureError('paddle', 'the body is not JSON')
    }
    return [this.translate(notification)]
  }

  private translate(notification: { event_id: string, event_type: string, data: Record<string, any> }): PaymentEvent {
    const data = notification.data ?? {}
    const base = {
      provider: this.name,
      id: notification.event_id,
      providerType: notification.event_type,
      merchantReference: typeof data.custom_data?.reference === 'string' ? data.custom_data.reference : null,
      raw: notification,
    }

    if (notification.event_type.startsWith('transaction.')) {
      const totals = data.details?.totals
      const amount = totals?.grand_total !== undefined && (totals.currency_code ?? data.currency_code)
        ? { amount: Number(totals.grand_total), currency: String(totals.currency_code ?? data.currency_code).toLowerCase() }
        : null
      const type: PaymentEventType = notification.event_type === 'transaction.completed'
        ? 'payment.succeeded'
        : notification.event_type === 'transaction.payment_failed'
          ? 'payment.failed'
          : notification.event_type === 'transaction.canceled' ? 'payment.canceled' : 'unknown'
      const lastAttempt = Array.isArray(data.payments) ? data.payments.at(-1) : undefined
      return {
        ...base,
        type,
        reference: typeof data.id === 'string' ? data.id : null,
        amount,
        reason: type === 'payment.failed' ? lastAttempt?.error_code ?? null : null,
      }
    }

    if (notification.event_type === 'adjustment.created' || notification.event_type === 'adjustment.updated') {
      const adjustment = data as PaddleAdjustment
      const settled = adjustment.action === 'refund' && (adjustment.status === 'approved' || adjustment.status === 'rejected')
      const currency = adjustment.totals?.currency_code ?? adjustment.currency_code
      return {
        ...base,
        // A refund can be created approved, or approved later: either way it
        // is one refund, so its id is the adjustment's and its outcome, not
        // the event's - two events for one approval must not refund twice.
        id: settled ? `adjustment:${adjustment.id}:${adjustment.status}` : notification.event_id,
        type: settled ? (adjustment.status === 'approved' ? 'refund.succeeded' : 'refund.failed') : 'unknown',
        reference: adjustment.transaction_id ?? null,
        amount: adjustment.totals?.total !== undefined && currency ? { amount: Number(adjustment.totals.total), currency: currency.toLowerCase() } : null,
        reason: adjustment.status === 'rejected' ? adjustment.reason ?? null : null,
      }
    }

    const subscriptionTypes: Record<string, PaymentEventType> = {
      'subscription.created': 'subscription.created',
      'subscription.canceled': 'subscription.canceled',
      'subscription.updated': 'subscription.updated',
      'subscription.activated': 'subscription.updated',
      'subscription.trialing': 'subscription.updated',
      'subscription.past_due': 'subscription.updated',
      'subscription.paused': 'subscription.updated',
      'subscription.resumed': 'subscription.updated',
    }
    return {
      ...base,
      type: subscriptionTypes[notification.event_type] ?? 'unknown',
      reference: typeof data.id === 'string' ? data.id : null,
      amount: null,
      reason: null,
    }
  }

  /** Paddle marks a delivery handled on a 200 within five seconds. */
  acknowledgeWebhook(): Response {
    return new Response(null, { status: 200 })
  }
}
