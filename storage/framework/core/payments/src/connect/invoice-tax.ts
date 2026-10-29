import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { asAccount } from './direct'
import { allPages } from './pagination'
import { invoiceTaxAmounts } from './tax'

export interface DirectInvoiceTaxFinancials {
  invoice: Stripe.Invoice
  creditNotes: Stripe.CreditNote[]
  currency: string
  gross: number
  net: number
  tax: number
  creditedGross: number
  creditedNet: number
  creditedTax: number
  /** Missing tax credits, pending refunds, bulk or non-cash credits need review. */
  requiresReview: boolean
}

function id(value: unknown): string {
  return typeof value === 'string' ? value : String((value as { id?: string } | null)?.id || '')
}

/** Read tax and actual credits on the original merchant. A cash refund does
 * not establish a tax reversal; only issued, balanced provider credit notes do.
 * Call under the application's payment lock alongside directChargeFinancials,
 * and compare this invoice's gross/currency with the original payment before
 * making contributor amounts available. This operation has no side effects.
 */
export async function directInvoiceTaxFinancials(invoiceId: string, paymentIntentId: string, account: string, client: Pick<Stripe, 'invoices' | 'invoicePayments' | 'refunds' | 'creditNotes'> = stripe): Promise<DirectInvoiceTaxFinancials> {
  const request = asAccount(account)
  if (!/^in_[a-z0-9_]+$/i.test(invoiceId) || !/^pi_[a-z0-9_]+$/i.test(paymentIntentId)) throw new Error('[payments/connect] Expected original invoice and payment identities')
  const invoice = await client.invoices.retrieve(invoiceId, {}, request)
  if (invoice.id !== invoiceId || invoice.status !== 'paid') throw new Error('[payments/connect] Expected the original paid invoice')
  const basis = invoiceTaxAmounts(invoice)
  const payments = await allPages<Stripe.InvoicePayment>(after => client.invoicePayments.list({ invoice: invoiceId, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
  if (!payments.some(payment => payment.status === 'paid' && id(payment.payment.payment_intent) === paymentIntentId)) throw new Error('[payments/connect] Invoice belongs to another payment')
  const refunds = await allPages<Stripe.Refund>(after => client.refunds.list({ payment_intent: paymentIntentId, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
  if (refunds.some(refund => id(refund.payment_intent) !== paymentIntentId || refund.currency !== invoice.currency || !Number.isSafeInteger(refund.amount) || refund.amount <= 0)) throw new Error('[payments/connect] Foreign or invalid invoice refund')
  const creditNotes = await allPages<Stripe.CreditNote>(after => client.creditNotes.list({ invoice: invoiceId, limit: 100, ...(after ? { starting_after: after } : {}) }, request))
  const invoiceLines = await allPages<Stripe.InvoiceLineItem>(after => client.invoices.listLineItems(invoiceId, { limit: 100, ...(after ? { starting_after: after } : {}) }, request))
  let requiresReview = refunds.some(refund => !['succeeded', 'failed', 'canceled'].includes(String(refund.status)))
  let creditedGross = 0
  let creditedNet = 0
  let creditedTax = 0
  const creditedRefunds = new Map<string, number>()
  for (const credit of creditNotes) {
    if (id(credit.invoice) !== invoiceId || id(credit.customer) !== id(invoice.customer) || credit.currency !== invoice.currency) throw new Error('[payments/connect] Foreign invoice tax credit')
    if (credit.status === 'void') continue
    if (credit.status !== 'issued') throw new Error('[payments/connect] Unknown invoice credit status')
    const amounts = invoiceTaxAmounts(credit)
    const lines = await allPages<Stripe.CreditNoteLineItem>(after => client.creditNotes.listLineItems(credit.id, { limit: 100, ...(after ? { starting_after: after } : {}) }, request))
    if (!lines.length || lines.some(line => line.type !== 'invoice_line_item')) requiresReview = true
    if (lines.some(line => line.type === 'invoice_line_item' && !invoiceLines.some(original => original.id === line.invoice_line_item))) throw new Error('[payments/connect] Tax credit references another invoice line')
    creditedGross += amounts.gross
    creditedNet += amounts.net
    creditedTax += amounts.tax
    let linkedGross = 0
    for (const link of credit.refunds) {
      const refund = refunds.find(row => row.id === id(link.refund))
      if (!refund || refund.status !== 'succeeded' || !Number.isSafeInteger(link.amount_refunded) || link.amount_refunded < 0) { requiresReview = true; continue }
      const credited = (creditedRefunds.get(refund.id) || 0) + link.amount_refunded
      creditedRefunds.set(refund.id, credited)
      if (credited > refund.amount) throw new Error('[payments/connect] Tax credits exceed the original refund')
      linkedGross += link.amount_refunded
    }
    if (linkedGross !== amounts.gross) requiresReview = true
  }
  const refunded = refunds.filter(refund => refund.status === 'succeeded').reduce((sum, refund) => sum + refund.amount, 0)
  if (creditedGross > basis.gross || creditedNet > basis.net || creditedTax > basis.tax || (basis.tax > 0 && (creditedGross !== refunded || refunds.some(refund => refund.status === 'succeeded' && creditedRefunds.get(refund.id) !== refund.amount)))) requiresReview = true
  return { invoice, creditNotes, currency: invoice.currency.toUpperCase(), ...basis, creditedGross, creditedNet, creditedTax, requiresReview }
}
