/**
 * Card-present payments through Stripe Terminal, the server-driven way: the
 * till asks the server to charge, the server tells a smart reader (WisePOS E,
 * S700, or a simulated one) to collect the card, and the till asks the server
 * how it went. Also `@stacksjs/payments/terminal`.
 *
 * - A Terminal **location** groups readers (one per shop or gym location).
 * - A **reader** is registered with the code it shows on screen and a label.
 * - A charge is a PaymentIntent with `payment_method_types: ['card_present']`,
 *   handed to a reader with `process_payment_intent`. The reader's `action`
 *   says whether it is waiting for the card, done, or failed (a decline, a
 *   timeout); `cancel_action` takes the charge off its screen.
 * - A refund to the card is an ordinary refund of that PaymentIntent (not
 *   Interac, which needs the card back at the reader).
 * - A connection token is for the client SDKs (Tap to Pay, Bluetooth readers).
 *
 * The client talks to Stripe's REST API directly (form-encoded requests, JSON
 * answers, `Idempotency-Key` on every create) instead of through the `stripe`
 * SDK: it needs no optional dependency, and `apiBase` lets a test point it at
 * an HTTP double of Stripe. The pure helpers (`terminalChargeState`,
 * `cardPresentDetails`) read Stripe's objects without any client.
 */

/** Stripe's error object (`{ error: { type, code, decline_code, message, param } }`). */
export class StripeApiError extends Error {
  readonly type: string
  readonly code: string | null
  readonly declineCode: string | null
  readonly param: string | null
  constructor(message: string, readonly status: number, error: { type?: string, code?: string, decline_code?: string, param?: string } = {}) {
    super(message)
    this.name = 'StripeApiError'
    this.type = error.type || (status === 0 ? 'api_connection_error' : 'api_error')
    this.code = error.code ?? null
    this.declineCode = error.decline_code ?? null
    this.param = error.param ?? null
  }

  /** Stripe refused the request itself; retrying the same one will not help. */
  get definitive(): boolean {
    return ['invalid_request_error', 'card_error', 'authentication_error', 'permission_error'].includes(this.type)
  }
}

export interface StripeRestOptions {
  /** A secret key (`sk_…`) or restricted key. */
  secretKey: string
  /** Defaults to https://api.stripe.com. */
  apiBase?: string
  /** A `Stripe-Version`; `STRIPE_TERMINAL_API_VERSION` unless given (null: the account's default). */
  apiVersion?: string | null
  /** Act on a connected account (`Stripe-Account`). */
  stripeAccount?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

/**
 * The API version these calls are written for. Pinned, so an account's
 * default version cannot change the shapes: on it a card-present
 * PaymentIntent names its method with `allowed_payment_method_types` (the
 * older `payment_method_types` is refused since 2026-09-30.endive).
 */
export const STRIPE_TERMINAL_API_VERSION = '2026-09-30.endive'

export type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue }

/**
 * Stripe's form encoding: nested objects as `a[b]=c`, arrays as `a[0]=x`,
 * booleans as `true`/`false`; null and undefined are left out.
 */
export function stripeFormEncode(params: Record<string, FormValue>): string {
  const pairs: string[] = []
  const add = (key: string, value: FormValue): void => {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) {
      value.forEach((item, index) => add(`${key}[${index}]`, item))
      return
    }
    if (typeof value === 'object') {
      for (const [child, inner] of Object.entries(value)) add(`${key}[${child}]`, inner)
      return
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  for (const [key, value] of Object.entries(params)) add(key, value)
  return pairs.join('&')
}

export interface StripeRequestOptions {
  idempotencyKey?: string
}

export interface StripeRest {
  request: <T = any>(method: 'GET' | 'POST' | 'DELETE', path: string, params?: Record<string, FormValue>, options?: StripeRequestOptions) => Promise<T>
}

/** A minimal Stripe REST client: one call, Stripe's errors as StripeApiError. */
export function stripeRest(options: StripeRestOptions): StripeRest {
  const base = (options.apiBase || 'https://api.stripe.com').replace(/\/$/, '')
  const doFetch = options.fetch ?? fetch
  return {
    async request(method, path, params = {}, requestOptions = {}) {
      const body = stripeFormEncode(params)
      const url = method === 'POST' || !body ? `${base}${path}` : `${base}${path}?${body}`
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${options.secretKey}`,
        'Accept': 'application/json',
      }
      if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'
      const version = options.apiVersion === undefined ? STRIPE_TERMINAL_API_VERSION : options.apiVersion
      if (version) headers['Stripe-Version'] = version
      if (options.stripeAccount) headers['Stripe-Account'] = options.stripeAccount
      if (requestOptions.idempotencyKey) headers['Idempotency-Key'] = requestOptions.idempotencyKey
      let res: Response
      try {
        res = await doFetch(url, { method, headers, body: method === 'POST' ? body : undefined, signal: AbortSignal.timeout(options.timeoutMs ?? 30_000) })
      }
      catch (error) {
        throw new StripeApiError(`Could not reach Stripe: ${error instanceof Error ? error.message : String(error)}`, 0)
      }
      const text = await res.text()
      let json: any = null
      try { json = text ? JSON.parse(text) : null }
      catch { json = null }
      if (!res.ok) {
        const error = json?.error && typeof json.error === 'object' ? json.error : {}
        throw new StripeApiError(typeof error.message === 'string' && error.message ? error.message : `Stripe answered ${res.status}`, res.status, error)
      }
      return json
    },
  }
}

export interface TerminalAddress {
  line1: string
  line2?: string | null
  city?: string | null
  postal_code?: string | null
  state?: string | null
  /** Two-letter country code. */
  country: string
}

export interface TerminalLocation {
  id: string
  object: 'terminal.location'
  display_name: string
  address: TerminalAddress
  metadata: Record<string, string>
  livemode: boolean
}

export interface ReaderAction {
  type: 'process_payment_intent' | 'process_setup_intent' | 'refund_payment' | 'set_reader_display' | string
  status: 'in_progress' | 'succeeded' | 'failed'
  failure_code: string | null
  failure_message: string | null
  process_payment_intent?: { payment_intent: string } | null
}

export interface TerminalReader {
  id: string
  object: 'terminal.reader'
  label: string
  device_type: string
  serial_number: string
  status: 'online' | 'offline' | null
  location: string | null
  ip_address: string | null
  device_sw_version: string | null
  action: ReaderAction | null
  metadata: Record<string, string>
  livemode: boolean
}

export interface CardPresentPaymentIntentInput {
  /** In the currency's minor unit. */
  amount: number
  currency: string
  description?: string
  metadata?: Record<string, string>
  /** Destination charges (Connect): whose charge it is and where the money goes. */
  onBehalfOf?: string
  transferDestination?: string
  /** The platform's fee on a destination charge, in the minor unit. */
  applicationFeeAmount?: number
  /** Taken from the card when the reader approves it, unless 'manual'. */
  captureMethod?: 'automatic' | 'manual'
  /** Shown on the cardholder's statement after the business name. */
  statementDescriptorSuffix?: string
}

export interface StripeTerminal {
  connectionToken: (location?: string) => Promise<{ object: 'terminal.connection_token', secret: string, location?: string }>
  createLocation: (input: { displayName: string, address: TerminalAddress, metadata?: Record<string, string> }, idempotencyKey?: string) => Promise<TerminalLocation>
  retrieveLocation: (id: string) => Promise<TerminalLocation>
  registerReader: (input: { registrationCode: string, label?: string, location: string, metadata?: Record<string, string> }) => Promise<TerminalReader>
  retrieveReader: (id: string) => Promise<TerminalReader>
  listReaders: (filter?: { location?: string, limit?: number }) => Promise<TerminalReader[]>
  deleteReader: (id: string) => Promise<{ id: string, deleted: boolean }>
  createPaymentIntent: (input: CardPresentPaymentIntentInput, idempotencyKey: string) => Promise<any>
  retrievePaymentIntent: (id: string) => Promise<any>
  cancelPaymentIntent: (id: string) => Promise<any>
  /** Puts the charge on the reader's screen; the answer is the reader, its action in progress. */
  processPaymentIntent: (readerId: string, paymentIntentId: string, idempotencyKey?: string) => Promise<TerminalReader>
  /** Takes whatever the reader is doing off its screen. */
  cancelReaderAction: (readerId: string) => Promise<TerminalReader>
  /** Test mode only: a simulated reader "reads" a card (a test card number picks the outcome). */
  presentPaymentMethod: (readerId: string, card?: { number?: string, type?: 'card_present' | 'interac_present' }) => Promise<TerminalReader>
  /** A refund of a card-present charge, back to the card. */
  refund: (input: { paymentIntent: string, amount?: number, reverseTransfer?: boolean, refundApplicationFee?: boolean, metadata?: Record<string, string>, reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' }, idempotencyKey: string) => Promise<any>
}

const path = (value: string): string => encodeURIComponent(value)

/** The Terminal calls a till makes, against Stripe or a double of it (`apiBase`). */
export function stripeTerminal(options: StripeRestOptions): StripeTerminal {
  const api = stripeRest(options)
  return {
    connectionToken: location => api.request('POST', '/v1/terminal/connection_tokens', { location }),
    createLocation: (input, idempotencyKey) => api.request('POST', '/v1/terminal/locations', {
      display_name: input.displayName,
      address: { ...input.address } as Record<string, FormValue>,
      metadata: input.metadata,
    }, { idempotencyKey }),
    retrieveLocation: id => api.request('GET', `/v1/terminal/locations/${path(id)}`),
    registerReader: input => api.request('POST', '/v1/terminal/readers', {
      registration_code: input.registrationCode,
      label: input.label,
      location: input.location,
      metadata: input.metadata,
    }),
    retrieveReader: id => api.request('GET', `/v1/terminal/readers/${path(id)}`),
    async listReaders(filter = {}) {
      const page = await api.request<{ data: TerminalReader[] }>('GET', '/v1/terminal/readers', { location: filter.location, limit: filter.limit ?? 100 })
      return Array.isArray(page?.data) ? page.data : []
    },
    deleteReader: id => api.request('DELETE', `/v1/terminal/readers/${path(id)}`),
    createPaymentIntent: (input, idempotencyKey) => api.request('POST', '/v1/payment_intents', {
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      allowed_payment_method_types: ['card_present'],
      capture_method: input.captureMethod ?? 'automatic',
      description: input.description,
      metadata: input.metadata,
      on_behalf_of: input.onBehalfOf,
      transfer_data: input.transferDestination ? { destination: input.transferDestination } : undefined,
      application_fee_amount: input.applicationFeeAmount && input.applicationFeeAmount > 0 ? input.applicationFeeAmount : undefined,
      statement_descriptor_suffix: input.statementDescriptorSuffix,
    }, { idempotencyKey }),
    retrievePaymentIntent: id => api.request('GET', `/v1/payment_intents/${path(id)}`, { expand: ['latest_charge'] }),
    cancelPaymentIntent: id => api.request('POST', `/v1/payment_intents/${path(id)}/cancel`),
    processPaymentIntent: (readerId, paymentIntentId, idempotencyKey) =>
      api.request('POST', `/v1/terminal/readers/${path(readerId)}/process_payment_intent`, { payment_intent: paymentIntentId }, { idempotencyKey }),
    cancelReaderAction: readerId => api.request('POST', `/v1/terminal/readers/${path(readerId)}/cancel_action`),
    presentPaymentMethod: (readerId, card = {}) => api.request('POST', `/v1/test_helpers/terminal/readers/${path(readerId)}/present_payment_method`, {
      type: card.type,
      card_present: card.number ? { number: card.number } : undefined,
    }),
    refund: (input, idempotencyKey) => api.request('POST', '/v1/refunds', {
      payment_intent: input.paymentIntent,
      amount: input.amount,
      reverse_transfer: input.reverseTransfer,
      refund_application_fee: input.refundApplicationFee,
      reason: input.reason,
      metadata: input.metadata,
    }, { idempotencyKey }),
  }
}

/** Where a card-present charge stands, from the PaymentIntent and the reader that has it. */
export type TerminalChargeState = 'waiting' | 'succeeded' | 'failed' | 'canceled'

export interface TerminalChargeOutcome {
  state: TerminalChargeState
  /** Stripe's code for a failure (`card_declined`, `reader_timeout`…), else null. */
  failureCode: string | null
  failureMessage: string | null
}

/**
 * Reads a charge's state the way Stripe's server-driven guide does: the
 * PaymentIntent decides success and cancellation; while it waits, the
 * reader's action for this PaymentIntent says whether the card was declined
 * or the reader gave up. A failed attempt leaves the PaymentIntent
 * `requires_payment_method`, so the same charge can go to the reader again.
 */
export function terminalChargeState(paymentIntent: { id?: string, status?: string, last_payment_error?: { code?: string, decline_code?: string, message?: string } | null } | null, reader?: Pick<TerminalReader, 'action'> | null): TerminalChargeOutcome {
  const status = paymentIntent?.status
  if (status === 'succeeded' || status === 'requires_capture') return { state: 'succeeded', failureCode: null, failureMessage: null }
  if (status === 'canceled') return { state: 'canceled', failureCode: null, failureMessage: null }
  const action = reader?.action
  const forThis = !!action && action.type === 'process_payment_intent'
    && (!paymentIntent?.id || action.process_payment_intent?.payment_intent === paymentIntent.id)
  if (forThis && action!.status === 'failed')
    return { state: 'failed', failureCode: action!.failure_code || 'reader_action_failed', failureMessage: action!.failure_message || null }
  if (forThis && action!.status === 'in_progress') return { state: 'waiting', failureCode: null, failureMessage: null }
  const error = paymentIntent?.last_payment_error
  if (status === 'requires_payment_method' && error)
    return { state: 'failed', failureCode: error.decline_code || error.code || 'card_declined', failureMessage: error.message || null }
  return { state: 'waiting', failureCode: null, failureMessage: null }
}

/** What a card receipt prints about the card, from a card-present charge. */
export interface CardPresentDetails {
  brand: string | null
  last4: string | null
  funding: string | null
  /** 'contactless_emv', 'contact_emv', 'magnetic_stripe_track2'… */
  readMethod: string | null
  /** The card application's name and identifier (AID), as an EMV receipt shows them. */
  applicationName: string | null
  applicationId: string | null
  authorizationCode: string | null
  authorizationResponseCode: string | null
  accountType: string | null
  cardholderVerification: string | null
}

/** The card details of a charge (or of a PaymentIntent with `latest_charge` expanded). */
export function cardPresentDetails(chargeOrIntent: any): CardPresentDetails | null {
  const charge = chargeOrIntent?.object === 'payment_intent'
    ? (typeof chargeOrIntent.latest_charge === 'object' && chargeOrIntent.latest_charge ? chargeOrIntent.latest_charge : chargeOrIntent.charges?.data?.[0])
    : chargeOrIntent
  const card = charge?.payment_method_details?.card_present ?? charge?.payment_method_details?.interac_present
  if (!card) return null
  const receipt = card.receipt ?? {}
  const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)
  return {
    brand: text(card.brand),
    last4: text(card.last4),
    funding: text(card.funding),
    readMethod: text(card.read_method),
    applicationName: text(receipt.application_preferred_name),
    applicationId: text(receipt.dedicated_file_name),
    authorizationCode: text(charge.authorization_code ?? receipt.authorization_code),
    authorizationResponseCode: text(receipt.authorization_response_code),
    accountType: text(receipt.account_type),
    cardholderVerification: text(receipt.cardholder_verification_method),
  }
}

/** The charge id behind a PaymentIntent (`latest_charge`, expanded or not). */
export function latestChargeId(paymentIntent: any): string | null {
  const charge = paymentIntent?.latest_charge
  if (typeof charge === 'string' && charge) return charge
  if (charge && typeof charge.id === 'string') return charge.id
  const legacy = paymentIntent?.charges?.data?.[0]?.id
  return typeof legacy === 'string' ? legacy : null
}

/** Registration codes Stripe accepts for a simulated reader in test mode. */
export const SIMULATED_READER_CODES = ['simulated-wpe', 'simulated-s700', 'simulated-s710', 'simulated-v660p', 'simulated-wp3'] as const

/** Whether a secret key is a test-mode key (simulated readers, test cards). */
export function isTestKey(secretKey: string | null | undefined): boolean {
  return typeof secretKey === 'string' && /^(sk|rk)_test_/.test(secretKey)
}
