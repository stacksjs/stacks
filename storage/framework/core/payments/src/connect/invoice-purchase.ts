import type Stripe from 'stripe'
import type { DirectInvoicePriceOptions } from './invoice-price'
import type { DirectInvoiceCollection } from './invoice-collection'
import { stripe } from '../drivers/stripe'
import { idempotencyFingerprint, stacksIdempotencyKey } from '../idempotency'
import { asAccount } from './direct'
import { collectDirectInvoice } from './invoice-collection'
import { allPages } from './pagination'
import { manageDestinationSubscription } from './subscription'

export interface DirectInvoicePurchaseOptions extends Pick<DirectInvoicePriceOptions, 'amount' | 'currency' | 'taxCode' | 'interval' | 'intervalCount'> {
  /** Durable logical purchase identity, distinct from the catalog offer. */
  reference: string
  customer: string
  price: string
  /** Original Checkout quote expiry, as Unix seconds. Expired attempts may
   * recover an existing purchase but cannot create a new invoice/schedule. */
  expiresAt: number
  platformFeePercent: number
  trialDays?: number
  metadata?: Record<string, string>
}

/** The quote expired without a bound purchase or an unbound provider resource
 * that could be an interrupted purchase. Original local IDs still need review. */
export class DirectInvoicePurchaseExpiredError extends Error {}

/** Copy onto Setup Checkout's setup_intent_data.metadata. Completion verifies
 * this binding before creating any purchase. The app owns explicit consent and
 * durable locking of the reference; metadata is not a substitute for either. */
export function directInvoicePurchaseMetadata(account: string, options: DirectInvoicePurchaseOptions): Record<string, string> {
  asAccount(account)
  if (typeof options.reference !== 'string' || !/^[a-z0-9:._-]{1,160}$/i.test(options.reference) || !/^cus_[a-z0-9_]+$/i.test(options.customer) || !/^price_[a-z0-9_]+$/i.test(options.price) || !Number.isSafeInteger(options.expiresAt) || options.expiresAt <= 0 || !Number.isSafeInteger(options.amount) || options.amount <= 0 || !/^[a-z]{3}$/i.test(options.currency) || !/^txcd_\d{8}$/.test(options.taxCode) || (options.interval !== undefined && !['day', 'week', 'month', 'year'].includes(options.interval)) || (options.intervalCount !== undefined && (!options.interval || !Number.isSafeInteger(options.intervalCount) || options.intervalCount < 1)) || (options.trialDays !== undefined && (!Number.isSafeInteger(options.trialDays) || options.trialDays < 0 || options.trialDays > 730 || (!options.interval && options.trialDays > 0))))
    throw new Error('[payments/connect] Expected original customer, price and frozen invoice purchase terms')
  if (options.platformFeePercent == null) throw new Error('[payments/connect] An explicit invoice fee percentage is required')
  manageDestinationSubscription.feePercentFor({ platformFeePercent: options.platformFeePercent })
  const metadata = options.metadata ?? {}
  if (typeof metadata !== 'object' || Array.isArray(metadata) || Object.keys(metadata).length > 47 || Object.entries(metadata).some(([key, value]) => !key || key.length > 40 || /[\[\]]/.test(key) || key.startsWith('stacks_purchase_') || typeof value !== 'string' || value.length > 500))
    throw new Error('[payments/connect] Invalid purchase metadata or reserved binding fields')
  const terms = { account, reference: options.reference, customer: options.customer, price: options.price, amount: options.amount, currency: options.currency.toLowerCase(), taxCode: options.taxCode, expiresAt: options.expiresAt, interval: options.interval ?? null, intervalCount: options.interval ? options.intervalCount ?? 1 : null, trialDays: options.trialDays ?? 0, platformFeePercent: options.platformFeePercent, metadata }
  return { ...metadata, stacks_purchase_reference: options.reference, stacks_purchase_quote: idempotencyFingerprint(terms) }
}

type PurchaseClient = Pick<Stripe, 'setupIntents' | 'prices' | 'paymentMethods' | 'invoices' | 'invoiceItems' | 'subscriptionSchedules' | 'subscriptions' | 'invoicePayments' | 'paymentIntents'>

function id(value: string | { id: string } | null | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

/** Complete only a successful setup bound to the original frozen quote. The
 * caller serializes the durable purchase reference. Provider lists recover the
 * original invoice/schedule beyond idempotency retention; no search-index lag
 * or process-local cache decides whether to create another purchase. */
export async function completeDirectInvoicePurchase(setupIntentId: string, account: string, options: DirectInvoicePurchaseOptions, client: PurchaseClient = stripe): Promise<DirectInvoiceCollection & { subscription?: Stripe.Subscription }> {
  const quote = directInvoicePurchaseMetadata(account, options)
  const request = asAccount(account)
  if (!/^seti_[a-z0-9_]+$/i.test(setupIntentId)) throw new Error('[payments/connect] Expected original successful payment setup')
  const setup = await client.setupIntents.retrieve(setupIntentId, {}, request)
  const matches = (metadata: Stripe.Metadata | null | undefined, expected: Record<string, string>) => Object.entries(expected).every(([key, value]) => metadata?.[key] === value)
  if (setup.id !== setupIntentId || setup.status !== 'succeeded' || setup.usage !== 'off_session' || !Number.isSafeInteger(setup.created) || setup.created <= 0 || id(setup.customer) !== options.customer || !/^pm_[a-z0-9_]+$/i.test(id(setup.payment_method) || '') || !matches(setup.metadata, quote))
    throw new Error('[payments/connect] Payment setup does not match the original customer and frozen quote')
  const paymentMethod = id(setup.payment_method)!
  const metadata = { ...quote, stacks_purchase_setup: setupIntentId }
  const key = (operation: string) => stacksIdempotencyKey(`connect.invoice.purchase.${operation}`, account, options.reference, quote.stacks_purchase_quote)
  const canCreate = (rows: Array<{ metadata: Stripe.Metadata | null }>) => {
    if (Date.now() / 1000 >= Math.min(options.expiresAt, setup.created + 24 * 60 * 60)) {
      if (rows.some(row => !row.metadata?.stacks_purchase_reference || !row.metadata.stacks_purchase_quote || !row.metadata.stacks_purchase_setup || row.metadata.stacks_purchase_setup === setupIntentId))
        throw new Error('[payments/connect] Expired purchase requires review of unbound original-customer resources')
      throw new DirectInvoicePurchaseExpiredError('[payments/connect] Expired purchase can only recover its original provider invoice or schedule')
    }
  }
  const existing = <T extends { metadata: Stripe.Metadata | null }>(rows: T[]) => {
    const own = rows.filter(row => row.metadata?.stacks_purchase_reference === options.reference)
    if (own.length > 1 || own.some(row => !matches(row.metadata, metadata)))
      throw new Error('[payments/connect] Purchase reference has ambiguous or different provider bindings')
    return own[0]
  }
  const verifyPrice = async () => {
    const price = await client.prices.retrieve(options.price, { expand: ['product'] }, request)
    const product = price.product
    if (price.id !== options.price || !price.active || price.currency !== options.currency.toLowerCase() || price.unit_amount !== options.amount || price.tax_behavior !== 'inclusive' || price.type !== (options.interval ? 'recurring' : 'one_time') || (options.interval ? price.recurring?.interval !== options.interval || price.recurring?.interval_count !== (options.intervalCount ?? 1) || price.recurring?.usage_type !== 'licensed' : price.recurring != null) || typeof product === 'string' || product.deleted || !product.active || id(product.tax_code) !== options.taxCode)
      throw new Error('[payments/connect] Catalog price does not match the approved inclusive purchase')
    const method = await client.paymentMethods.retrieve(paymentMethod, {}, request)
    if (method.id !== paymentMethod || id(method.customer) !== options.customer)
      throw new Error('[payments/connect] Purchase payment method belongs to another customer')
  }
  let invoice: Stripe.Invoice
  let subscription: Stripe.Subscription | undefined
  let reloadSubscription: (() => Promise<Stripe.Subscription>) | undefined
  if (options.interval) {
    const schedules = await allPages<Stripe.SubscriptionSchedule>(after => client.subscriptionSchedules.list({ customer: options.customer, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
    let schedule = existing(schedules)
    if (!schedule) {
      canCreate(schedules)
      await verifyPrice()
      const phase: Stripe.SubscriptionScheduleCreateParams.Phase = { items: [{ price: options.price, quantity: 1 }], automatic_tax: { enabled: true }, metadata }
      schedule = await client.subscriptionSchedules.create({ customer: options.customer, start_date: 'now', end_behavior: 'release', default_settings: { default_payment_method: paymentMethod }, phases: options.trialDays ? [{ ...phase, trial: true, duration: { interval: 'day', interval_count: options.trialDays } }, phase] : [phase], metadata }, { ...request, idempotencyKey: key('schedule') })
    }
    const subscriptionId = id(schedule.subscription) ?? id(schedule.released_subscription)
    if (!/^sub_sched_[a-z0-9_]+$/i.test(schedule.id) || id(schedule.customer) !== options.customer || !matches(schedule.metadata, metadata) || !/^sub_[a-z0-9_]+$/i.test(subscriptionId || ''))
      throw new Error('[payments/connect] Purchase schedule has no original customer and subscription')
    const readSubscription = async () => {
      const value = await client.subscriptions.retrieve(subscriptionId!, {}, request)
      if (value.id !== subscriptionId || id(value.customer) !== options.customer || !matches(value.metadata, metadata) || value.items.has_more || value.items.data.length !== 1 || id(value.items.data[0]!.price) !== options.price || value.items.data[0]!.quantity !== 1)
        throw new Error('[payments/connect] Subscription does not match the original frozen purchase')
      return value
    }
    reloadSubscription = readSubscription
    subscription = await readSubscription()
    const invoices = await allPages<Stripe.Invoice>(after => client.invoices.list({ customer: options.customer, subscription: subscriptionId!, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
    const initial = invoices.filter(value => value.billing_reason === 'subscription_create' && id(value.parent?.subscription_details?.subscription) === subscriptionId)
    if (initial.length !== 1) throw new Error('[payments/connect] Purchase has no unique original subscription invoice')
    invoice = await client.invoices.retrieve(initial[0]!.id, {}, request)
    if (invoice.id !== initial[0]!.id || id(invoice.customer) !== options.customer || id(invoice.parent?.subscription_details?.subscription) !== subscriptionId || !matches(invoice.parent?.subscription_details?.metadata, metadata))
      throw new Error('[payments/connect] First invoice does not match the original subscription quote')
    if (invoice.status !== 'paid' && ['canceled', 'incomplete_expired', 'unpaid'].includes(subscription.status))
      throw new Error('[payments/connect] Subscription no longer permits its initial collection')
    // Hold before releasing the schedule, including recovery after a lost
    // schedule-create response. Releasing preserves native trial_end/state.
    if (invoice.status === 'draft' && invoice.auto_advance !== false) {
      invoice = await client.invoices.update(invoice.id, { auto_advance: false }, { ...request, idempotencyKey: key('hold') })
      if (invoice.id !== initial[0]!.id || id(invoice.customer) !== options.customer || id(invoice.parent?.subscription_details?.subscription) !== subscriptionId || !matches(invoice.parent?.subscription_details?.metadata, metadata))
        throw new Error('[payments/connect] Held invoice no longer matches the original subscription')
    }
    if (schedule.status === 'active') {
      if (id(subscription.schedule) !== schedule.id) throw new Error('[payments/connect] Subscription belongs to another schedule')
      const trialEnd = subscription.trial_end
      const released = await client.subscriptionSchedules.release(schedule.id, {}, { ...request, idempotencyKey: key('release') })
      if (released.id !== schedule.id || released.status !== 'released' || id(released.released_subscription) !== subscriptionId)
        throw new Error('[payments/connect] Schedule release did not preserve its original subscription')
      subscription = await readSubscription()
      if (subscription.schedule != null || subscription.trial_end !== trialEnd)
        throw new Error('[payments/connect] Released purchase changed its schedule or native trial')
      if (invoice.status !== 'paid' && ['canceled', 'incomplete_expired', 'unpaid'].includes(subscription.status))
        throw new Error('[payments/connect] Subscription no longer permits its initial collection')
    }
    else if (!['released', 'completed', 'canceled'].includes(schedule.status)) {
      throw new Error('[payments/connect] Purchase schedule has not started')
    }
  }
  else {
    const invoices = await allPages<Stripe.Invoice>(after => client.invoices.list({ customer: options.customer, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
    const previous = existing(invoices)
    if (previous) invoice = await client.invoices.retrieve(previous.id, {}, request)
    else {
      canCreate(invoices)
      await verifyPrice()
      invoice = await client.invoices.create({ customer: options.customer, currency: options.currency.toLowerCase(), auto_advance: false, automatic_tax: { enabled: true }, default_payment_method: paymentMethod, pending_invoice_items_behavior: 'exclude', metadata }, { ...request, idempotencyKey: key('create') })
    }
    if (!/^in_[a-z0-9_]+$/i.test(invoice.id) || (previous && invoice.id !== previous.id) || id(invoice.customer) !== options.customer || !matches(invoice.metadata, metadata))
      throw new Error('[payments/connect] Purchase invoice belongs to another customer or quote')
    let lines = await allPages<Stripe.InvoiceLineItem>(after => client.invoices.listLineItems(invoice.id, { limit: 100, ...(after ? { starting_after: after } : {}) }, request))
    if (lines.length === 0 && invoice.status === 'draft') {
      if (previous) await verifyPrice()
      await client.invoiceItems.create({ customer: options.customer, invoice: invoice.id, pricing: { price: options.price }, quantity: 1 }, { ...request, idempotencyKey: key('line') })
      lines = await allPages<Stripe.InvoiceLineItem>(after => client.invoices.listLineItems(invoice.id, { limit: 100, ...(after ? { starting_after: after } : {}) }, request))
    }
    if (lines.length !== 1 || lines[0]!.quantity !== 1 || id(lines[0]!.pricing?.price_details?.price) !== options.price)
      throw new Error('[payments/connect] Purchase invoice contains different catalog lines')
  }
  if (!invoice.automatic_tax.enabled) throw new Error('[payments/connect] Purchase invoice no longer uses its original automatic tax policy')
  const collected = await collectDirectInvoice(invoice.id, account, { customer: options.customer, ...(subscription ? { subscription: subscription.id } : {}), currency: options.currency, platformFeePercent: options.platformFeePercent, approvedTotal: options.trialDays ? 0 : options.amount, paymentMethod }, client)
  return { ...collected, ...(reloadSubscription ? { subscription: await reloadSubscription() } : {}) }
}
