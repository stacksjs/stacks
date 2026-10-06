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
  StoredPaymentMethod,
  WebhookRequest,
} from './types'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { assertMoney, PaymentProviderError, PaymentUnsupportedError, WebhookSignatureError } from './types'

/**
 * The Adyen driver (stacksjs/stacks#450), on Checkout API v72.
 *
 * Adyen is a processor like Stripe, not a merchant of record, so payments,
 * hosted checkout, refunds, stored cards and webhooks map across. It has no
 * product catalog, no subscriptions, no invoices and no customer object:
 * a payer is a `shopperReference` you choose, and recurring billing is charging
 * a stored card on your own schedule. Those operations throw
 * {@link PaymentUnsupportedError}.
 *
 * Verified against Adyen's API reference and its published HMAC example; not
 * yet run against a live merchant account.
 */
export interface AdyenConfig {
  apiKey: string
  merchantAccount: string
  /** `test` for checkout-test.adyen.com, `live` for your live endpoint. */
  environment: 'test' | 'live'
  /** Your live URL prefix from the Customer Area. Required in `live`. */
  liveUrlPrefix?: string
  /** Hex HMAC key of your standard webhook. Required to verify webhooks. */
  hmacKey?: string
  /**
   * The application's own URL. When set, every return URL must be on its
   * origin, as Stripe's checkout requires: a forged request cannot send the
   * payer to a look-alike page after paying.
   */
  appUrl?: string
  /**
   * Prefix for the shopper reference made from a user id. Adyen requires it
   * to identify the shopper without personal data, so it is never the email.
   */
  shopperReferencePrefix?: string
}

export const ADYEN_API_VERSION = 'v72'

const CAPABILITIES: ReadonlySet<PaymentOperation> = new Set<PaymentOperation>([
  'customers',
  'charge',
  'createPayment',
  'refund',
  'checkout',
  'paymentMethods',
  'webhooks',
])

/**
 * Adyen's `resultCode` in our terms. Only `Authorised`, `Refused`, `Error`
 * and `Cancelled` are final; everything else waits on the payer or a webhook.
 */
export function adyenStatus(resultCode: string | undefined): PaymentStatus {
  switch (resultCode) {
    case 'Authorised':
      return 'succeeded'
    case 'Refused':
    case 'Error':
      return 'failed'
    case 'Cancelled':
      return 'canceled'
    case 'RedirectShopper':
    case 'ChallengeShopper':
    case 'IdentifyShopper':
    case 'PresentToShopper':
      return 'requires_action'
    default:
      // Pending, Received, PartiallyAuthorised, AuthenticationFinished,
      // AuthenticationNotRequired: accepted, outcome to follow.
      return 'processing'
  }
}

const EVENT_TYPES: Record<string, [ok: PaymentEventType, failed: PaymentEventType]> = {
  AUTHORISATION: ['payment.succeeded', 'payment.failed'],
  CANCELLATION: ['payment.canceled', 'unknown'],
  REFUND: ['refund.succeeded', 'refund.failed'],
  REFUND_FAILED: ['refund.failed', 'refund.failed'],
  CANCEL_OR_REFUND: ['refund.succeeded', 'refund.failed'],
}

interface NotificationItem {
  pspReference?: string
  originalReference?: string
  merchantAccountCode?: string
  merchantReference?: string
  amount?: { value?: number, currency?: string }
  eventCode?: string
  success?: string | boolean
  reason?: string
  additionalData?: Record<string, string>
}

/**
 * The string Adyen signs for a standard webhook item: eight fields joined by
 * colons, empty ones as empty strings.
 */
export function adyenSigningPayload(item: NotificationItem): string {
  return [
    item.pspReference ?? '',
    item.originalReference ?? '',
    item.merchantAccountCode ?? '',
    item.merchantReference ?? '',
    item.amount?.value ?? '',
    item.amount?.currency ?? '',
    item.eventCode ?? '',
    String(item.success ?? ''),
  ].join(':')
}

/** HMAC-SHA256 of the signing payload under the hex key, base64. */
export function adyenSignature(item: NotificationItem, hmacKey: string): string {
  return createHmac('sha256', Buffer.from(hmacKey, 'hex')).update(adyenSigningPayload(item), 'utf8').digest('base64')
}

export class AdyenDriver implements PaymentDriver {
  readonly name = 'adyen'
  readonly capabilities = CAPABILITIES
  private readonly config: AdyenConfig
  private readonly fetch: typeof fetch

  constructor(config: AdyenConfig, options: { fetch?: typeof fetch } = {}) {
    if (!config.apiKey)
      throw new Error('The Adyen payment driver needs an API key: set ADYEN_API_KEY or payment.adyen.apiKey.')
    if (!config.merchantAccount)
      throw new Error('The Adyen payment driver needs a merchant account: set ADYEN_MERCHANT_ACCOUNT or payment.adyen.merchantAccount.')
    if (config.environment === 'live' && !config.liveUrlPrefix)
      throw new Error('Adyen live requests go to your account\'s own endpoint: set ADYEN_LIVE_URL_PREFIX or payment.adyen.liveUrlPrefix.')
    this.config = config
    this.fetch = options.fetch ?? fetch
  }

  /** The Checkout API base for this environment. */
  get baseUrl(): string {
    return this.config.environment === 'live'
      ? `https://${this.config.liveUrlPrefix}-checkout-live.adyenpayments.com/checkout/${ADYEN_API_VERSION}`
      : `https://checkout-test.adyen.com/${ADYEN_API_VERSION}`
  }

  /** The shopper reference for a payer: the prefix and the user id, never personal data. */
  shopperReference(payer: Payer): string {
    return `${this.config.shopperReferencePrefix ?? 'user-'}${payer.id}`
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: { body?: unknown, query?: Record<string, string>, idempotencyKey?: string } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(options.query ?? {}))
      url.searchParams.set(key, value)

    const headers: Record<string, string> = { 'X-API-Key': this.config.apiKey, 'Accept': 'application/json' }
    if (options.body !== undefined)
      headers['Content-Type'] = 'application/json'
    if (options.idempotencyKey)
      headers['Idempotency-Key'] = options.idempotencyKey

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
      const error = body as { message?: string, errorCode?: string } | undefined
      throw new PaymentProviderError('adyen', response.status, error?.message ?? response.statusText, error?.errorCode ?? null)
    }
    return body as T
  }

  /** Refuse a return URL off the application's origin. */
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

  private amount(money: Money): { value: number, currency: string } {
    assertMoney(money)
    return { value: money.amount, currency: money.currency.toUpperCase() }
  }

  async customer(payer: Payer): Promise<Customer> {
    // Adyen has no customer object: the shopper reference is the customer.
    return { id: this.shopperReference(payer), email: payer.email ?? null, name: payer.name ?? null }
  }

  async charge(payer: Payer, amount: Money, paymentMethod: string, options: ChargeOptions = {}): Promise<PaymentResult> {
    const response = await this.request<{ pspReference: string, resultCode?: string, refusalReason?: string, action?: { url?: string } }>('POST', '/payments', {
      body: {
        merchantAccount: this.config.merchantAccount,
        amount: this.amount(amount),
        reference: options.reference ?? randomUUID(),
        paymentMethod: { type: 'scheme', storedPaymentMethodId: paymentMethod },
        shopperReference: this.shopperReference(payer),
        // A server-initiated charge of a stored card.
        shopperInteraction: 'ContAuth',
        recurringProcessingModel: 'UnscheduledCardOnFile',
        ...(options.metadata ? { metadata: options.metadata } : {}),
      },
      idempotencyKey: options.idempotencyKey,
    })

    return {
      id: response.pspReference,
      status: adyenStatus(response.resultCode),
      amount: { amount: amount.amount, currency: amount.currency.toLowerCase() },
      ...(response.action?.url ? { redirectUrl: response.action.url } : {}),
      ...(response.refusalReason ? { failureReason: response.refusalReason } : {}),
      raw: response,
    }
  }

  async createPayment(payer: Payer, amount: Money, options: CreatePaymentOptions = {}): Promise<PaymentResult> {
    if (!options.returnUrl)
      throw new TypeError('An Adyen payment session needs a returnUrl: where the payer comes back after authenticating.')
    this.assertReturnUrl(options.returnUrl, 'returnUrl')
    const session = await this.request<{ id: string, sessionData: string }>('POST', '/sessions', {
      body: {
        merchantAccount: this.config.merchantAccount,
        amount: this.amount(amount),
        reference: options.reference ?? randomUUID(),
        returnUrl: options.returnUrl,
        mode: 'embedded',
        shopperReference: this.shopperReference(payer),
        ...(options.metadata ? { metadata: options.metadata } : {}),
      },
      idempotencyKey: options.idempotencyKey,
    })

    return {
      id: session.id,
      status: 'requires_payment_method',
      amount: { amount: amount.amount, currency: amount.currency.toLowerCase() },
      clientConfirmation: { provider: 'adyen', sessionId: session.id, sessionData: session.sessionData },
      raw: session,
    }
  }

  async refund(paymentId: string, options: RefundOptions = {}): Promise<RefundResult> {
    const reference = randomUUID()
    // A partial refund names its amount. A full one is a reversal, which needs
    // none - and also cancels a payment that was authorised but not captured.
    const response = options.amount
      ? await this.request<{ pspReference: string, status?: string }>('POST', `/payments/${encodeURIComponent(paymentId)}/refunds`, {
          body: { merchantAccount: this.config.merchantAccount, amount: this.amount(options.amount), reference },
          idempotencyKey: options.idempotencyKey,
        })
      : await this.request<{ pspReference: string, status?: string }>('POST', `/payments/${encodeURIComponent(paymentId)}/reversals`, {
          body: { merchantAccount: this.config.merchantAccount, reference },
          idempotencyKey: options.idempotencyKey,
        })

    return {
      id: response.pspReference,
      paymentId,
      // Adyen acknowledges with `received`; the outcome arrives as a REFUND webhook.
      status: 'pending',
      amount: options.amount ? { amount: options.amount.amount, currency: options.amount.currency.toLowerCase() } : null,
      raw: response,
    }
  }

  async checkout(payer: Payer, request: CheckoutRequest): Promise<CheckoutSession> {
    if (request.mode === 'subscription')
      throw new PaymentUnsupportedError('adyen', 'subscription checkout', 'Adyen has no subscriptions; store a card with mode "setup" and charge it on your schedule')
    if (request.cancelUrl && request.cancelUrl !== request.successUrl)
      throw new PaymentUnsupportedError('adyen', 'a separate cancelUrl', 'Adyen\'s hosted checkout returns to one URL, with the outcome in its query string')
    if (request.allowPromotionCodes)
      throw new PaymentUnsupportedError('adyen', 'promotion codes', 'Adyen has no coupons; discount the line amounts instead')
    if (request.automaticTax)
      throw new PaymentUnsupportedError('adyen', 'automatic tax', 'Adyen does not calculate tax; price each line including it')
    if (!request.currency)
      throw new TypeError('An Adyen checkout needs a currency.')
    this.assertReturnUrl(request.successUrl, 'successUrl')

    const lines = request.lines.map((line) => {
      if ('price' in line)
        throw new PaymentUnsupportedError('adyen', 'catalog prices', 'Adyen has no product catalog; price each line with name and unitAmount')
      return line
    })
    const total = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0)
    const setup = request.mode === 'setup'

    const session = await this.request<{ id: string, url?: string, expiresAt?: string }>('POST', '/sessions', {
      body: {
        merchantAccount: this.config.merchantAccount,
        // A setup session authorises nothing; Adyen tokenises the card on a zero amount.
        amount: this.amount({ amount: setup ? 0 : total, currency: request.currency }),
        reference: request.reference ?? randomUUID(),
        returnUrl: request.successUrl,
        mode: 'hosted',
        shopperReference: this.shopperReference(payer),
        ...(payer.email ? { shopperEmail: payer.email } : {}),
        ...(setup ? { storePaymentMethodMode: 'enabled', recurringProcessingModel: 'UnscheduledCardOnFile' } : {}),
        ...(setup
          ? {}
          : {
              lineItems: lines.map(line => ({
                description: line.name,
                quantity: line.quantity,
                amountIncludingTax: line.unitAmount,
              })),
            }),
        ...(request.metadata ? { metadata: request.metadata } : {}),
      },
    })

    if (!session.url)
      throw new PaymentProviderError('adyen', 200, 'the hosted session came back without a url')
    return { id: session.id, url: session.url, expiresAt: session.expiresAt ? new Date(session.expiresAt) : null, raw: session }
  }

  async paymentMethods(payer: Payer): Promise<StoredPaymentMethod[]> {
    const response = await this.request<{ storedPaymentMethods?: Array<Record<string, any>> }>('GET', '/storedPaymentMethods', {
      query: { merchantAccount: this.config.merchantAccount, shopperReference: this.shopperReference(payer) },
    })
    return (response?.storedPaymentMethods ?? []).map(method => ({
      id: String(method.id),
      type: String(method.type ?? 'scheme'),
      brand: method.brand ?? null,
      last4: method.lastFour ?? null,
      expMonth: method.expiryMonth ? Number(method.expiryMonth) : null,
      // Adyen gives the year as two digits on some methods.
      expYear: method.expiryYear ? Number(String(method.expiryYear).length === 2 ? `20${method.expiryYear}` : method.expiryYear) : null,
      // Adyen has no default stored method; the shopper chooses at payment.
      isDefault: false,
      raw: method,
    }))
  }

  async removePaymentMethod(payer: Payer, paymentMethodId: string): Promise<void> {
    await this.request('DELETE', `/storedPaymentMethods/${encodeURIComponent(paymentMethodId)}`, {
      query: { merchantAccount: this.config.merchantAccount, shopperReference: this.shopperReference(payer) },
    })
  }

  async subscribe(): Promise<never> {
    throw new PaymentUnsupportedError('adyen', 'subscriptions', 'charge a stored card on your own schedule with charge()')
  }

  async cancelSubscription(): Promise<never> {
    throw new PaymentUnsupportedError('adyen', 'subscriptions')
  }

  async subscriptions(): Promise<never> {
    throw new PaymentUnsupportedError('adyen', 'subscriptions')
  }

  /**
   * Verify every item of a standard webhook and translate it. One item that
   * does not verify rejects the delivery: Adyen retries it, and nothing from a
   * forged batch is acted on.
   */
  async verifyWebhook(request: WebhookRequest): Promise<PaymentEvent[]> {
    if (!this.config.hmacKey)
      throw new Error('Adyen webhooks cannot be verified without the HMAC key: set ADYEN_HMAC_KEY or payment.adyen.hmacKey.')

    let body: { notificationItems?: Array<{ NotificationRequestItem?: NotificationItem }> }
    try {
      body = JSON.parse(request.payload)
    }
    catch {
      throw new WebhookSignatureError('adyen', 'the body is not JSON')
    }

    const items = (body.notificationItems ?? []).map(entry => entry.NotificationRequestItem).filter((item): item is NotificationItem => Boolean(item))
    if (items.length === 0)
      throw new WebhookSignatureError('adyen', 'the delivery holds no notification items')

    return items.map((item) => {
      const given = item.additionalData?.hmacSignature
      if (!given)
        throw new WebhookSignatureError('adyen', `item ${item.pspReference ?? '?'} has no hmacSignature`)
      const expected = Buffer.from(adyenSignature(item, this.config.hmacKey!))
      const actual = Buffer.from(given)
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
        throw new WebhookSignatureError('adyen', `item ${item.pspReference ?? '?'} is signed with another key`)

      const success = String(item.success) === 'true'
      const pair = EVENT_TYPES[item.eventCode ?? '']
      return {
        provider: this.name,
        // An event code and reference identify a notification, and Adyen resends
        // the pair on retry. It can also resend the pair with the outcome changed,
        // which is a new fact rather than a retry, so the outcome is part of it.
        id: `${item.eventCode}:${item.pspReference}:${success}`,
        type: pair ? pair[success ? 0 : 1] : 'unknown',
        providerType: item.eventCode ?? '',
        // A modification (refund, cancellation) names its own reference and the
        // payment's as `originalReference`; the event is about the payment.
        reference: item.originalReference || item.pspReference || null,
        reason: item.reason || null,
        merchantReference: item.merchantReference ?? null,
        amount: item.amount?.value !== undefined && item.amount.currency
          ? { amount: Number(item.amount.value), currency: item.amount.currency.toLowerCase() }
          : null,
        raw: item,
      }
    })
  }

  /**
   * Adyen marks a delivery handled on a 2xx within 10 seconds, and documents
   * 202. The `[accepted]` body is what older integrations were required to
   * send, and is still understood.
   */
  acknowledgeWebhook(): Response {
    return new Response('[accepted]', { status: 202, headers: { 'Content-Type': 'text/plain' } })
  }
}
