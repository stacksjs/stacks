import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { idempotencyFingerprint, stacksIdempotencyKey } from '../idempotency'
import { asAccount } from './direct'
import { allPages } from './pagination'
import { invoiceTaxAmounts } from './tax'

export interface InvoiceRefundLine {
  invoiceLineItem: string
  /** Amount credited from this line in its ORIGINAL price's tax behavior.
   * An inclusive price uses inclusive minor units. Stripe's preview, not an
   * inferred rate, must produce exactly the original refund amount. */
  amount: number
}

export interface DirectInvoiceRefundCredit {
  creditNote: Stripe.CreditNote
  gross: number
  net: number
  tax: number
  currency: string
}

function id(value: unknown): string {
  return typeof value === 'string' ? value : String((value as { id?: string } | null)?.id || '')
}

/** Link a successful direct refund to its ORIGINAL invoice lines. This creates
 * a credit note with Stripe's actual tax reversal, never a second refund.
 * Amount-only credit notes can omit tax entirely. All reads and the credit are
 * scoped to the original merchant. An existing matching credit is returned on
 * replay, including after Stripe's idempotency retention has elapsed.
 */
export async function creditDirectInvoiceRefund(invoiceId: string, account: string, refundId: string, lines: readonly InvoiceRefundLine[], client: Pick<Stripe, 'invoices' | 'invoicePayments' | 'refunds' | 'creditNotes'> = stripe): Promise<DirectInvoiceRefundCredit> {
  const request = asAccount(account)
  if (!/^in_[a-z0-9_]+$/i.test(invoiceId) || !/^re_[a-z0-9_]+$/i.test(refundId) || !lines.length || lines.length > 100 || lines.some(line => !/^il_[a-z0-9_]+$/i.test(line.invoiceLineItem) || !Number.isSafeInteger(line.amount) || line.amount <= 0) || new Set(lines.map(line => line.invoiceLineItem)).size !== lines.length)
    throw new Error('[payments/connect] Expected original invoice, refund and unique positive credit lines')
  const invoice = await client.invoices.retrieve(invoiceId, {}, request)
  const refund = await client.refunds.retrieve(refundId, {}, request)
  if (invoice.id !== invoiceId || invoice.status !== 'paid' || refund.id !== refundId || refund.status !== 'succeeded' || refund.currency !== invoice.currency || !Number.isSafeInteger(refund.amount) || refund.amount <= 0 || !id(refund.payment_intent))
    throw new Error('[payments/connect] Expected the original paid invoice and successful refund in its currency')
  const payments = await allPages<Stripe.InvoicePayment>(after => client.invoicePayments.list({ invoice: invoiceId, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
  if (!payments.some(payment => payment.status === 'paid' && id(payment.payment.payment_intent) === id(refund.payment_intent)))
    throw new Error('[payments/connect] Refund belongs to another invoice payment')
  const invoiceLines = await allPages<Stripe.InvoiceLineItem>(after => client.invoices.listLineItems(invoiceId, { limit: 100, ...(after ? { starting_after: after } : {}) }, request))
  if (lines.some(line => !invoiceLines.some(original => original.id === line.invoiceLineItem)))
    throw new Error('[payments/connect] Credit line belongs to another invoice')
  const params = {
    invoice: invoiceId,
    lines: [...lines].sort((a, b) => a.invoiceLineItem.localeCompare(b.invoiceLineItem)).map(line => ({ type: 'invoice_line_item' as const, invoice_line_item: line.invoiceLineItem, amount: line.amount })),
    refunds: [{ refund: refundId, amount_refunded: refund.amount }],
  }
  const verify = (credit: Stripe.CreditNote): DirectInvoiceRefundCredit => {
    if (id(credit.invoice) !== invoiceId || id(credit.customer) !== id(invoice.customer) || credit.currency !== invoice.currency || credit.total !== refund.amount)
      throw new Error('[payments/connect] Credit does not match the original invoice or refund amount')
    return { creditNote: credit, ...invoiceTaxAmounts(credit), currency: invoice.currency.toUpperCase() }
  }
  const validateIssued = async (credit: Stripe.CreditNote) => {
    const result = verify(credit)
    if (credit.status !== 'issued' || credit.refunds.length !== 1 || id(credit.refunds[0]!.refund) !== refundId || credit.refunds[0]!.amount_refunded !== refund.amount)
      throw new Error('[payments/connect] Credit does not bind the complete original refund')
    const actual = await allPages<Stripe.CreditNoteLineItem>(after => client.creditNotes.listLineItems(credit.id, { limit: 100, ...(after ? { starting_after: after } : {}) }, request))
    if (actual.length !== lines.length || actual.some(line => line.type !== 'invoice_line_item' || !lines.some(expected => expected.invoiceLineItem === line.invoice_line_item && expected.amount === line.amount)))
      throw new Error('[payments/connect] Refund was credited with different invoice lines')
    return result
  }
  const credits = await allPages<Stripe.CreditNote>(after => client.creditNotes.list({ invoice: invoiceId, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
  const previous = credits.filter(credit => credit.status === 'issued' && credit.refunds.some(row => id(row.refund) === refundId))
  if (previous.length > 1) throw new Error('[payments/connect] Refund is associated with several credit notes')
  if (previous[0]) return validateIssued(previous[0])
  verify(await client.creditNotes.preview(params, request))
  const credit = await client.creditNotes.create({ ...params, email_type: 'none' }, {
    ...request,
    idempotencyKey: stacksIdempotencyKey('connect.invoice.refund-credit', account, invoiceId, refundId, idempotencyFingerprint(params)),
  })
  return validateIssued(credit)
}
