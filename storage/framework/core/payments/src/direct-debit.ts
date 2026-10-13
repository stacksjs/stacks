/**
 * Bank debits through Stripe: SEPA Direct Debit, Bacs, ACH and BECS next to
 * cards. Which methods a checkout may offer in a currency, which currency a
 * payer's country pays in, what a webhook event means for a debit (still
 * processing, collected, failed, or returned by the bank), and the mandate a
 * debit runs under.
 *
 * Pure: no Stripe client and no database, so a browser bundle or a unit test
 * can import it (`@stacksjs/payments/direct-debit`). The one function that
 * talks to Stripe, `retrieveDebitMandate`, takes the client as an argument.
 *
 * A debit is a delayed-notification payment: Checkout completes with
 * `payment_status: 'unpaid'`, the charge stays `pending` for days, and only
 * `checkout.session.async_payment_succeeded`, `invoice.paid` or
 * `charge.succeeded` says the money arrived. A subscription can turn `active`
 * while its first debit is still processing, so never grant what was bought
 * from the subscription status alone. Weeks later the payer's bank can still
 * take the money back (`charge.dispute.created`): for SEPA, a "no questions
 * asked" refund for eight weeks, and final.
 */

export type PaymentMethodType = 'card' | 'sepa_debit' | 'bacs_debit' | 'us_bank_account' | 'au_becs_debit'

export interface PaymentMethodInfo {
  /** Currencies the method can be charged in, lowercase; null when any. */
  currencies: readonly string[] | null
  /** The outcome arrives days later, by webhook (a bank debit). */
  delayed: boolean
  /** The payer accepts a mandate that lets the merchant debit the account. */
  mandate: boolean
  /**
   * The fewest calendar days before a debit the payer must be told about it,
   * when the merchant sends that notice itself. SEPA's rulebook says 14 unless
   * the mandate agrees otherwise; Stripe's SEPA mandate text agrees to 2.
   * Null where the provider always sends the notice itself (Bacs) or the
   * scheme has no such rule here.
   */
  noticeDays: number | null
}

export const PAYMENT_METHODS: Readonly<Record<PaymentMethodType, PaymentMethodInfo>> = {
  card: { currencies: null, delayed: false, mandate: false, noticeDays: null },
  sepa_debit: { currencies: ['eur'], delayed: true, mandate: true, noticeDays: 2 },
  bacs_debit: { currencies: ['gbp'], delayed: true, mandate: true, noticeDays: null },
  us_bank_account: { currencies: ['usd'], delayed: true, mandate: true, noticeDays: null },
  au_becs_debit: { currencies: ['aud'], delayed: true, mandate: true, noticeDays: null },
}

export function isPaymentMethodType(value: unknown): value is PaymentMethodType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, value)
}

/** Whether a payment method's outcome arrives later, by webhook (a bank debit). */
export function isDelayedPaymentMethod(type: unknown): boolean {
  return isPaymentMethodType(type) && PAYMENT_METHODS[type].delayed
}

/**
 * A stored list of payment methods (an array, or a comma-separated string as a
 * text column keeps it), known types only, each once, in the order given.
 * Empty or unreadable is cards only.
 */
export function parsePaymentMethods(value: unknown): PaymentMethodType[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const types: PaymentMethodType[] = []
  for (const item of items) {
    const type = typeof item === 'string' ? item.trim().toLowerCase() : item
    if (isPaymentMethodType(type) && !types.includes(type))
      types.push(type)
  }
  return types.length ? types : ['card']
}

/** Whether a method can be charged in `currency` (ISO 4217, any case). */
export function methodSupportsCurrency(type: PaymentMethodType, currency: string): boolean {
  const currencies = PAYMENT_METHODS[type].currencies
  return currencies === null || currencies.includes(String(currency || '').toLowerCase())
}

/**
 * The methods a checkout in `currency` offers, from those the merchant allows:
 * a method the currency cannot use (SEPA outside euros) is left out, and a
 * list left empty falls back to cards. This is Stripe's `allowed_payment_method_types`.
 */
export function paymentMethodsFor(allowed: unknown, currency: string): PaymentMethodType[] {
  const usable = parsePaymentMethods(allowed).filter(type => methodSupportsCurrency(type, currency))
  return usable.length ? usable : ['card']
}

/** Countries that pay in euros: the euro area (Bulgaria from 2026) and the states that use it by agreement. */
export const EURO_COUNTRIES: readonly string[] = [
  'AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
  'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
]

/** Countries in the SEPA scheme, whose bank accounts SEPA Direct Debit reaches. */
export const SEPA_COUNTRIES: readonly string[] = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  'IS', 'LI', 'NO', 'CH', 'GB', 'AD', 'MC', 'SM', 'VA', 'GI',
]

const COUNTRY_CURRENCIES: Readonly<Record<string, string>> = {
  US: 'usd',
  GB: 'gbp',
  CH: 'chf',
  LI: 'chf',
  AU: 'aud',
  CA: 'cad',
  NZ: 'nzd',
  SE: 'sek',
  DK: 'dkk',
  NO: 'nok',
  PL: 'pln',
  CZ: 'czk',
  JP: 'jpy',
}

/** The region of a BCP 47 language tag, upper case: 'de-AT' is 'AT', plain 'de' is null. */
export function regionOfLocale(tag: unknown): string | null {
  if (typeof tag !== 'string') return null
  const parts = tag.trim().replace(/_/g, '-').split('-')
  for (const part of parts.slice(1)) {
    if (/^[a-z]{2}$/i.test(part)) return part.toUpperCase()
    if (/^\d{3}$/.test(part)) return null
  }
  return null
}

/**
 * The currency a payer in `country` (ISO 3166 alpha-2) pays in, if the app
 * sells in it, else `fallback`: euros across the euro area, pounds in the UK,
 * and so on.
 */
export function currencyForCountry(country: unknown, supported: readonly string[], fallback: string): string {
  const code = typeof country === 'string' ? country.trim().toUpperCase() : ''
  const currency = EURO_COUNTRIES.includes(code) ? 'eur' : COUNTRY_CURRENCIES[code]
  const offered = supported.map(value => value.toLowerCase())
  return currency && offered.includes(currency) ? currency : fallback.toLowerCase()
}

export interface DebitDetails {
  type: PaymentMethodType
  /** The Stripe mandate the debit runs under (`mandate_...`). */
  mandateId: string | null
  /** Last four digits of the account: what a debit notice names it by. Never the full IBAN. */
  last4: string | null
  bankCode: string | null
  country: string | null
  /** When the bank is expected to debit the account, yyyy-mm-dd (an estimate). */
  expectedDebitDate: string | null
}

function ymdOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0)
    return new Date(value * 1000).toISOString().slice(0, 10)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))
    return value.slice(0, 10)
  return null
}

/**
 * The debit behind a charge (`payment_method_details`) or a payment method
 * (its own `sepa_debit`, `bacs_debit`... block): the method, the account's
 * last four digits and the mandate. Null for a card or anything else that is
 * not a bank debit.
 */
export function debitDetailsOf(source: any): DebitDetails | null {
  const details = source?.payment_method_details ?? source
  const type = details?.type
  if (!isDelayedPaymentMethod(type)) return null
  const block = details[type] ?? {}
  const str = (value: unknown): string | null => typeof value === 'string' && value ? value : null
  return {
    type,
    mandateId: str(typeof block.mandate === 'object' ? block.mandate?.id : block.mandate),
    last4: str(block.last4),
    bankCode: str(block.bank_code ?? block.sort_code ?? block.routing_number ?? block.bsb_number),
    country: str(block.country),
    expectedDebitDate: ymdOf(block.expected_debit_date),
  }
}

export interface MandateReference {
  id: string
  /** The mandate reference the payer's bank shows, and every debit notice must name. */
  reference: string | null
  /** Stripe's page with the mandate the payer accepted. */
  url: string | null
  /** active | inactive | pending */
  status: string
  type: string | null
}

/** What a Stripe Mandate says about itself: its reference, page and status. */
export function mandateReferenceOf(mandate: any): MandateReference | null {
  if (!mandate?.id) return null
  const type = mandate.payment_method_details?.type ?? null
  const block = type ? mandate.payment_method_details?.[type] ?? {} : {}
  return {
    id: String(mandate.id),
    reference: block.reference ? String(block.reference) : null,
    url: block.url ? String(block.url) : null,
    status: String(mandate.status || 'active'),
    type: type ? String(type) : null,
  }
}

/** The mandate's reference and status, from Stripe. `stripe` is the client (`@stacksjs/payments`' `stripe`). */
export async function retrieveDebitMandate(stripe: { mandates: { retrieve: (id: string) => Promise<any> } }, mandateId: string): Promise<MandateReference | null> {
  if (!mandateId) return null
  return mandateReferenceOf(await stripe.mandates.retrieve(mandateId))
}

/**
 * What a debit event means: the debit was submitted and is `processing`, it
 * `succeeded`, it `failed` before the money arrived, the bank `returned` it
 * after it had succeeded (a dispute, which for SEPA is final), or the mandate
 * stopped working (`mandate_inactive`).
 */
export type DebitOutcome = 'processing' | 'succeeded' | 'failed' | 'returned' | 'mandate_inactive'

export interface DebitEvent {
  outcome: DebitOutcome
  /** The debit method, when the event says (a dispute or Checkout session may not). */
  method: PaymentMethodType | null
  paymentIntentId: string | null
  chargeId: string | null
  checkoutSessionId: string | null
  mandateId: string | null
  /** Minor units. */
  amount: number | null
  currency: string | null
  failureCode: string | null
  failureMessage: string | null
  details: DebitDetails | null
  metadata: Record<string, string>
}

const idOf = (value: any): string | null => value ? String(typeof value === 'object' ? value.id : value) : null

/**
 * A Stripe event, read as a step in a bank debit's life; null when it is not
 * one (a card charge, an unrelated event). Covers Checkout's asynchronous
 * results, the charge's `pending` / `succeeded` / `failed`, a dispute (the
 * bank's return), and a mandate that went inactive. Invoices are left to the
 * caller: `invoice.paid` and `invoice.payment_failed` mean the same for a
 * card and a debit.
 */
export function debitEventOf(event: { type?: string, data?: { object?: any } } | null | undefined): DebitEvent | null {
  const type = String(event?.type || '')
  const object: any = event?.data?.object ?? {}
  const base = (outcome: DebitOutcome, extra: Partial<DebitEvent> = {}): DebitEvent => ({
    outcome,
    method: null,
    paymentIntentId: null,
    chargeId: null,
    checkoutSessionId: null,
    mandateId: null,
    amount: null,
    currency: null,
    failureCode: null,
    failureMessage: null,
    details: null,
    metadata: object?.metadata && typeof object.metadata === 'object' ? { ...object.metadata } : {},
    ...extra,
  })

  if (type.startsWith('checkout.session.')) {
    const session = {
      checkoutSessionId: idOf(object.id),
      paymentIntentId: idOf(object.payment_intent),
      amount: Number.isFinite(object.amount_total) ? Number(object.amount_total) : null,
      currency: object.currency ? String(object.currency).toLowerCase() : null,
    }
    // Completed but unpaid: the payer accepted the mandate and the debit was submitted.
    if (type === 'checkout.session.completed' && object.payment_status === 'unpaid')
      return base('processing', session)
    if (type === 'checkout.session.async_payment_succeeded')
      return base('succeeded', session)
    if (type === 'checkout.session.async_payment_failed')
      return base('failed', session)
    return null
  }

  if (type === 'charge.pending' || type === 'charge.succeeded' || type === 'charge.failed') {
    const details = debitDetailsOf(object)
    if (!details) return null
    const outcome: DebitOutcome = type === 'charge.pending' ? 'processing' : type === 'charge.succeeded' ? 'succeeded' : 'failed'
    return base(outcome, {
      method: details.type,
      paymentIntentId: idOf(object.payment_intent),
      chargeId: idOf(object.id),
      mandateId: details.mandateId,
      amount: Number.isFinite(object.amount) ? Number(object.amount) : null,
      currency: object.currency ? String(object.currency).toLowerCase() : null,
      failureCode: outcome === 'failed' && object.failure_code ? String(object.failure_code) : null,
      failureMessage: outcome === 'failed' && object.failure_message ? String(object.failure_message) : null,
      details,
    })
  }

  if (type === 'charge.dispute.created') {
    const method = object.payment_method_details?.type
    // A card dispute can be fought; it is not a debit's return.
    if (method === 'card') return null
    return base('returned', {
      method: isDelayedPaymentMethod(method) ? method : null,
      paymentIntentId: idOf(object.payment_intent),
      chargeId: idOf(object.charge),
      amount: Number.isFinite(object.amount) ? Number(object.amount) : null,
      currency: object.currency ? String(object.currency).toLowerCase() : null,
      failureCode: object.reason ? String(object.reason) : null,
    })
  }

  if (type === 'mandate.updated') {
    if (object.status !== 'inactive') return null
    const method = object.payment_method_details?.type
    return base('mandate_inactive', {
      method: isDelayedPaymentMethod(method) ? method : null,
      mandateId: idOf(object.id),
    })
  }

  return null
}

/**
 * What to ask of the payer after a failed debit, by Stripe's failure code:
 * `retry` (the account is fine, it just could not pay: insufficient funds),
 * `update` (new bank details or a new mandate are needed), or `contact` (the
 * bank gave no reason, or one only a conversation can settle).
 */
export function debitFailureNextStep(code: unknown): 'retry' | 'update' | 'contact' {
  switch (code) {
    case 'insufficient_funds':
      return 'retry'
    case 'account_closed':
    case 'authorization_revoked':
    case 'debit_not_authorized':
    case 'debit_authorization_not_match':
    case 'incorrect_account_holder_name':
    case 'invalid_account_number':
    case 'branch_does_not_exist':
    case 'bank_account_restricted':
      return 'update'
    default:
      return 'contact'
  }
}

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Whether today is the day to send the notice for a debit on `debitDate`
 * (yyyy-mm-dd): from `leadDays` before it, until the debit. `leadDays` is
 * raised to the method's `noticeDays` so the notice is never planned later
 * than the rules allow.
 */
export function isDebitNoticeDue(input: { debitDate: string, today: string, leadDays: number, method?: PaymentMethodType }): boolean {
  const debit = ymdOf(input.debitDate)
  const today = ymdOf(input.today)
  if (!debit || !today) return false
  const minimum = input.method ? PAYMENT_METHODS[input.method].noticeDays ?? 0 : 0
  const opens = addDays(debit, -Math.max(minimum, Math.floor(input.leadDays)))
  return today >= opens && today < debit
}

/** Whether a notice sent on `sentOn` came early enough for a debit on `debitDate`. */
export function isDebitNoticeTimely(input: { sentOn: string, debitDate: string, method: PaymentMethodType }): boolean {
  const sent = ymdOf(input.sentOn)
  const debit = ymdOf(input.debitDate)
  if (!sent || !debit) return false
  return sent <= addDays(debit, -(PAYMENT_METHODS[input.method].noticeDays ?? 0))
}
