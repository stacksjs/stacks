import { describe, expect, test } from 'bun:test'
import { directInvoiceTaxFinancials } from '../src/connect/invoice-tax'

function fixture() {
  const invoice: any = { id: 'in_sale', status: 'paid', customer: 'cus_buyer', currency: 'eur', total: 1999, total_excluding_tax: 1680, total_taxes: [{ amount: 319 }], automatic_tax: { enabled: true, status: 'complete' } }
  const refund: any = { id: 're_sale', payment_intent: 'pi_sale', currency: 'eur', status: 'succeeded', amount: 500 }
  const credit: any = { id: 'cn_sale', invoice: 'in_sale', customer: 'cus_buyer', currency: 'eur', status: 'issued', total: 500, total_excluding_tax: 420, total_taxes: [{ amount: 80 }], refunds: [{ refund: 're_sale', amount_refunded: 500 }] }
  const lines: any[] = [{ id: 'cnli_sale', type: 'invoice_line_item', invoice_line_item: 'il_sale', amount: 500 }]
  let credits: any[] = [credit]
  const list = (data: () => any[]) => async (_params: any, options: any) => { expect(options.stripeAccount).toBe('acct_merchant'); return { data: data(), has_more: false } }
  const client: any = {
    invoices: { retrieve: async (_id: string, _params: any, options: any) => { expect(options.stripeAccount).toBe('acct_merchant'); return invoice }, listLineItems: async (_id: string, params: any, options: any) => list(() => [{ id: 'il_sale' }])(params, options) },
    invoicePayments: { list: list(() => [{ id: 'inpay_sale', status: 'paid', payment: { payment_intent: 'pi_sale' } }]) },
    refunds: { list: list(() => [refund]) },
    creditNotes: { list: list(() => credits), listLineItems: async (_id: string, params: any, options: any) => list(() => lines)(params, options) },
  }
  return { invoice, refund, credit, lines, client, credits: (rows: any[]) => { credits = rows }, run: () => directInvoiceTaxFinancials('in_sale', 'pi_sale', 'acct_merchant', client) }
}

describe('canonical invoice tax and credits', () => {
  test('reads the actual tax and refund credit without inferring a proportional rate', async () => {
    expect(await fixture().run()).toMatchObject({ gross: 1999, net: 1680, tax: 319, creditedGross: 500, creditedNet: 420, creditedTax: 80, currency: 'EUR', requiresReview: false })
  })

  test('holds a tax-bearing refund with no matching tax credit instead of inventing a reversal', async () => {
    const f = fixture()
    f.credits([])
    expect(await f.run()).toMatchObject({ tax: 319, creditedTax: 0, requiresReview: true })
  })

  test('keeps pending, bulk and customer-balance credits under review', async () => {
    for (const change of ['pending', 'bulk', 'balance', 'void']) {
      const f = fixture()
      if (change === 'pending') f.refund.status = 'pending'
      if (change === 'bulk') f.lines.length = 0
      if (change === 'balance') f.credit.refunds = []
      if (change === 'void') f.credit.status = 'void'
      expect((await f.run()).requiresReview).toBe(true)
    }
  })

  test('does not require a tax credit to establish that a zero-tax invoice has zero tax', async () => {
    const f = fixture()
    f.invoice.total_excluding_tax = 1999
    f.invoice.total_taxes = []
    f.credits([])
    expect(await f.run()).toMatchObject({ tax: 0, creditedTax: 0, requiresReview: false })
  })

  test('rejects foreign payment, refund, invoice and credit references', async () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => { f.invoice.id = 'in_foreign' },
      (f: ReturnType<typeof fixture>) => { f.refund.payment_intent = 'pi_foreign' },
      (f: ReturnType<typeof fixture>) => { f.credit.invoice = 'in_foreign' },
      (f: ReturnType<typeof fixture>) => { f.credit.currency = 'usd' },
      (f: ReturnType<typeof fixture>) => { f.lines[0].invoice_line_item = 'il_foreign' },
      (f: ReturnType<typeof fixture>) => { f.credit.total_excluding_tax = null },
    ]) {
      const f = fixture()
      change(f)
      await expect(f.run()).rejects.toThrow()
    }
    await expect(directInvoiceTaxFinancials('in_sale', 'pi_foreign', 'acct_merchant', fixture().client)).rejects.toThrow()
  })
})
