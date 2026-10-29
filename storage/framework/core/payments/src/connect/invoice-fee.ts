import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { stacksIdempotencyKey } from '../idempotency'
import { asAccount } from './direct'
import { splitFee } from './destination'
import { manageDestinationSubscription } from './subscription'
import { invoiceTaxAmounts } from './tax'

export interface DirectInvoiceFeeOptions {
  /** Original merchant customer and, for recurring sales, subscription. */
  customer: string
  subscription?: string
  currency: string
  /** Percentage of the invoice value AFTER tax, with at most two decimals. */
  platformFeePercent: number
}

export interface DirectInvoiceFee {
  invoice: Stripe.Invoice
  currency: string
  gross: number
  tax: number
  net: number
  fee: number
}

function id(value: string | { id: string } | null | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.id
}

function amounts(invoice: Stripe.Invoice): Pick<DirectInvoiceFee, 'gross' | 'tax' | 'net'> {
  const totals = invoiceTaxAmounts(invoice)
  if (invoice.amount_due !== totals.gross)
    throw new Error('[payments/connect] Invoice credits or balance adjustments require a separate fee settlement')
  return totals
}

/** Set an exact tax-exclusive fee on a draft invoice on its original merchant.
 * Collection is held before returning; the caller owns finalization/payment and
 * durable retries. Use invoice.created for renewals and a subscription schedule
 * for an editable first invoice. Checkout's immediately finalized first invoice
 * cannot be changed by this API. Never infer a tax rate from locale or currency.
 * https://docs.stripe.com/connect/subscriptions#collect-fees
 */
export async function prepareDirectInvoiceFee(invoiceId: string, account: string, options: DirectInvoiceFeeOptions, client: Pick<Stripe, 'invoices'> = stripe): Promise<DirectInvoiceFee> {
  const request = asAccount(account)
  if (!/^in_[a-z0-9_]+$/i.test(invoiceId) || !/^cus_[a-z0-9_]+$/i.test(options.customer) || (options.subscription != null && !/^sub_[a-z0-9_]+$/i.test(options.subscription)) || !/^[a-z]{3}$/i.test(options.currency))
    throw new Error('[payments/connect] Expected original invoice, customer, subscription and currency')
  if (options.platformFeePercent == null) throw new Error('[payments/connect] An explicit invoice fee percentage is required')
  manageDestinationSubscription.feePercentFor({ platformFeePercent: options.platformFeePercent })
  const invoice = await client.invoices.retrieve(invoiceId, {}, request)
  const verify = (value: Stripe.Invoice) => {
    if (value.id !== invoiceId || value.status !== 'draft' || id(value.customer) !== options.customer || id(value.parent?.subscription_details?.subscription) !== options.subscription || value.currency.toUpperCase() !== options.currency.toUpperCase())
      throw new Error('[payments/connect] Fee requires the original draft invoice, customer, subscription and currency')
    return amounts(value)
  }
  const basis = verify(invoice)
  const feeBps = Math.round(options.platformFeePercent * 100)
  const fee = splitFee(basis.net, { platform: feeBps, merchant: 10000 - feeBps }, 'merchant').platform
  const updated = await client.invoices.update(invoiceId, { auto_advance: false, application_fee_amount: fee }, {
    ...request,
    idempotencyKey: stacksIdempotencyKey('connect.invoice.tax-fee', account, invoiceId, basis.gross, basis.tax, fee),
  })
  const current = verify(updated)
  if (current.gross !== basis.gross || current.tax !== basis.tax)
    throw new Error('[payments/connect] Invoice tax or amount changed while preparing the fee; collection remains held')
  return { invoice: updated, currency: invoice.currency.toUpperCase(), ...basis, fee }
}
