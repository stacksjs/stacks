import type Stripe from 'stripe'
import type { DirectInvoiceFeeOptions } from './invoice-fee'
import { stripe } from '../drivers/stripe'
import { stacksIdempotencyKey } from '../idempotency'
import { asAccount } from './direct'
import { splitFee } from './destination'
import { prepareDirectInvoiceFee } from './invoice-fee'
import { allPages } from './pagination'
import { manageDestinationSubscription } from './subscription'
import { invoiceTaxAmounts } from './tax'

export interface DirectInvoiceCollectionOptions extends DirectInvoiceFeeOptions {
  /** The inclusive amount the buyer approved, in minor units. Zero for a trial. */
  approvedTotal: number
  /** A saved payment method belonging to the original merchant customer. */
  paymentMethod: string
}

export interface DirectInvoiceCollection {
  invoice: Stripe.Invoice
  status: 'paid' | 'requires_payment' | 'processing'
  paymentIntent?: Stripe.PaymentIntent
  paymentUrl?: string
  currency: string
  gross: number
  net: number
  tax: number
  fee: number
}

function id(value: string | { id: string } | null | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

/** Collect an original merchant invoice only after validating the approved
 * total, tax and exact after-tax application fee. Drafts remain held while
 * preparing/finalizing. Open invoices can be recovered without recreating a
 * purchase; paid invoices are read-only replays. A card requiring customer
 * action returns Stripe's hosted invoice instead of granting access. Network
 * failures propagate for the caller's durable retry. No proportional tax math.
 */
export async function collectDirectInvoice(invoiceId: string, account: string, options: DirectInvoiceCollectionOptions, client: Pick<Stripe, 'invoices' | 'invoicePayments' | 'paymentMethods' | 'paymentIntents'> = stripe): Promise<DirectInvoiceCollection> {
  const request = asAccount(account)
  if (!/^in_[a-z0-9_]+$/i.test(invoiceId) || !/^cus_[a-z0-9_]+$/i.test(options.customer) || (options.subscription != null && !/^sub_[a-z0-9_]+$/i.test(options.subscription)) || !/^[a-z]{3}$/i.test(options.currency) || !/^pm_[a-z0-9_]+$/i.test(options.paymentMethod) || !Number.isSafeInteger(options.approvedTotal) || options.approvedTotal < 0)
    throw new Error('[payments/connect] Expected original invoice, customer, subscription, currency, saved method and approved total')
  if (options.platformFeePercent == null) throw new Error('[payments/connect] An explicit invoice fee percentage is required')
  manageDestinationSubscription.feePercentFor({ platformFeePercent: options.platformFeePercent })
  const verify = (value: Stripe.Invoice) => {
    if (value.id !== invoiceId || !['draft', 'open', 'paid'].includes(value.status || '') || id(value.customer) !== options.customer || id(value.parent?.subscription_details?.subscription) !== options.subscription || value.currency.toUpperCase() !== options.currency.toUpperCase() || value.amount_due !== options.approvedTotal)
      throw new Error('[payments/connect] Collection requires the original collectible invoice and approved amount')
    const totals = invoiceTaxAmounts(value)
    if (totals.gross !== options.approvedTotal)
      throw new Error('[payments/connect] Invoice total differs from the buyer-approved amount')
    return totals
  }
  let invoice = await client.invoices.retrieve(invoiceId, {}, request)
  const basis = verify(invoice)
  const bps = Math.round(options.platformFeePercent * 100)
  const fee = splitFee(basis.net, { platform: bps, merchant: 10000 - bps }, 'merchant').platform
  const stable = (value: Stripe.Invoice) => {
    const totals = verify(value)
    if (totals.net !== basis.net || totals.tax !== basis.tax)
      throw new Error('[payments/connect] Invoice tax changed during collection; payment was not authorized')
  }
  if (invoice.status !== 'paid' && invoice.auto_advance !== false) {
    invoice = await client.invoices.update(invoiceId, { auto_advance: false }, {
      ...request, idempotencyKey: stacksIdempotencyKey('connect.invoice.hold', account, invoiceId),
    })
    stable(invoice)
  }
  if (invoice.status !== 'paid' && basis.gross > 0) {
    const method = await client.paymentMethods.retrieve(options.paymentMethod, {}, request)
    if (method.id !== options.paymentMethod || id(method.customer) !== options.customer)
      throw new Error('[payments/connect] Saved payment method belongs to another customer')
  }
  if (invoice.status === 'draft') {
    const prepared = await prepareDirectInvoiceFee(invoiceId, account, options, client)
    stable(prepared.invoice)
    invoice = await client.invoices.finalizeInvoice(invoiceId, { auto_advance: false }, {
      ...request, idempotencyKey: stacksIdempotencyKey('connect.invoice.finalize', account, invoiceId, basis.gross, basis.tax, fee),
    })
    stable(invoice)
  }
  const result = (status: DirectInvoiceCollection['status'], intent?: Stripe.PaymentIntent): DirectInvoiceCollection => ({
    invoice, status, ...(intent ? { paymentIntent: intent } : {}),
    ...(status === 'requires_payment' && invoice.hosted_invoice_url ? { paymentUrl: invoice.hosted_invoice_url } : {}),
    currency: invoice.currency.toUpperCase(), ...basis, fee,
  })
  // A zero trial invoice finalizes as paid without creating a payment intent.
  if (basis.gross === 0) {
    if (invoice.status !== 'paid') throw new Error('[payments/connect] Zero invoice has not been marked paid by the provider')
    return result('paid')
  }
  const payments = await allPages<Stripe.InvoicePayment>(after => client.invoicePayments.list({ invoice: invoiceId, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
  const candidates = payments.filter(payment => payment.status !== 'canceled' && payment.payment.type === 'payment_intent')
  if (candidates.length !== 1 || id(candidates[0]!.invoice) !== invoiceId || !id(candidates[0]!.payment.payment_intent))
    throw new Error('[payments/connect] Expected one canonical invoice payment intent')
  const intentId = id(candidates[0]!.payment.payment_intent)!
  const readIntent = async () => {
    const intent = await client.paymentIntents.retrieve(intentId, {}, request)
    if (intent.id !== intentId || id(intent.customer) !== options.customer || intent.currency.toUpperCase() !== options.currency.toUpperCase() || intent.amount !== basis.gross || (intent.application_fee_amount ?? 0) !== fee || intent.status === 'canceled')
      throw new Error('[payments/connect] Invoice payment does not match its original customer, currency, amount or after-tax fee')
    return intent
  }
  let intent = await readIntent()
  if (invoice.status === 'paid') {
    if (intent.status !== 'succeeded') throw new Error('[payments/connect] Paid invoice has no successful original payment')
    return result('paid', intent)
  }
  if (intent.status === 'processing' || intent.status === 'succeeded') return result('processing', intent)
  if (intent.status === 'requires_action') return result('requires_payment', intent)
  if (!['requires_confirmation', 'requires_payment_method'].includes(intent.status))
    throw new Error('[payments/connect] Invoice payment is not ready for automatic collection')
  try {
    invoice = await client.invoices.pay(invoiceId, { payment_method: options.paymentMethod, off_session: true }, {
      ...request, idempotencyKey: stacksIdempotencyKey('connect.invoice.pay', account, invoiceId, intentId, options.paymentMethod, basis.gross, basis.tax, fee),
    })
    stable(invoice)
    intent = await readIntent()
    if (invoice.status === 'paid' && intent.status !== 'succeeded') throw new Error('[payments/connect] Paid invoice has no successful original payment')
    return result(invoice.status === 'paid' ? 'paid' : ['processing', 'succeeded'].includes(intent.status) ? 'processing' : 'requires_payment', intent)
  }
  catch (error) {
    if ((error as { type?: string })?.type !== 'StripeCardError') throw error
    invoice = await client.invoices.retrieve(invoiceId, {}, request)
    stable(invoice)
    intent = await readIntent()
    if (invoice.status === 'paid' && intent.status !== 'succeeded') throw new Error('[payments/connect] Paid invoice has no successful original payment')
    return result(invoice.status === 'paid' ? 'paid' : 'requires_payment', intent)
  }
}
