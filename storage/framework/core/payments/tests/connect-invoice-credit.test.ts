import { describe, expect, test } from 'bun:test'
import { creditDirectInvoiceRefund } from '../src/connect/invoice-credit'

function fixture() {
  const writes: any[] = []
  const reads: any[] = []
  const invoice: any = { id: 'in_sale', status: 'paid', customer: 'cus_buyer', currency: 'eur' }
  const refund: any = { id: 're_sale', payment_intent: 'pi_sale', status: 'succeeded', amount: 500, currency: 'eur' }
  const credit: any = { id: 'cn_sale', invoice: 'in_sale', customer: 'cus_buyer', currency: 'eur', status: 'issued', total: 500, total_excluding_tax: 420, total_taxes: [{ amount: 80 }], refunds: [{ refund: 're_sale', amount_refunded: 500 }], lines: { data: [{ id: 'cnli_sale', type: 'invoice_line_item', invoice_line_item: 'il_sale', amount: 500 }], has_more: false } }
  let existing: any[] = []
  const read = (name: string, result: () => any) => async (...args: any[]) => { reads.push({ name, args }); return result() }
  const client: any = {
    invoices: { retrieve: read('invoice', () => invoice), listLineItems: read('lines', () => ({ data: [{ id: 'il_sale' }], has_more: false })) },
    refunds: { retrieve: read('refund', () => refund) },
    invoicePayments: { list: read('payments', () => ({ data: [{ id: 'inpay_sale', status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_sale' } }], has_more: false })) },
    creditNotes: {
      list: read('credits', () => ({ data: existing, has_more: false })),
      listLineItems: read('creditLines', () => credit.lines),
      preview: read('preview', () => credit),
      create: async (params: any, options: any) => { writes.push({ params, options }); existing = [credit]; return credit },
    },
  }
  const lines = [{ invoiceLineItem: 'il_sale', amount: 500 }]
  return { invoice, refund, credit, client, reads, writes, lines, existing: (rows: any[]) => { existing = rows }, run: () => creditDirectInvoiceRefund('in_sale', 'acct_merchant', 're_sale', lines, client) }
}

describe('direct invoice refund credit notes', () => {
  test('preserves original line tax and binds the existing refund without moving money again', async () => {
    const f = fixture()
    expect(await f.run()).toMatchObject({ gross: 500, net: 420, tax: 80, currency: 'EUR' })
    expect(f.writes[0]).toMatchObject({ params: { invoice: 'in_sale', lines: [{ type: 'invoice_line_item', invoice_line_item: 'il_sale', amount: 500 }], refunds: [{ refund: 're_sale', amount_refunded: 500 }], email_type: 'none' }, options: { stripeAccount: 'acct_merchant' } })
    expect(f.writes[0].options.idempotencyKey).toBeTruthy()
    for (const read of f.reads) expect(read.args.at(-1).stripeAccount).toBe('acct_merchant')
    await f.run()
    expect(f.writes).toHaveLength(1)
  })

  test('refuses foreign, pending and differently credited refunds', async () => {
    for (const corrupt of [
      (f: ReturnType<typeof fixture>) => { f.refund.status = 'pending' },
      (f: ReturnType<typeof fixture>) => { f.refund.payment_intent = 'pi_foreign' },
      (f: ReturnType<typeof fixture>) => { f.refund.currency = 'usd' },
      (f: ReturnType<typeof fixture>) => { f.refund.id = 're_foreign' },
      (f: ReturnType<typeof fixture>) => { f.invoice.id = 'in_foreign' },
      (f: ReturnType<typeof fixture>) => { f.lines[0]!.invoiceLineItem = 'il_foreign' },
      (f: ReturnType<typeof fixture>) => { f.credit.total_excluding_tax = 500 },
      (f: ReturnType<typeof fixture>) => { f.credit.invoice = 'in_foreign' },
      (f: ReturnType<typeof fixture>) => { f.credit.lines.data[0].invoice_line_item = 'il_foreign'; f.existing([f.credit]) },
    ]) {
      const f = fixture()
      corrupt(f)
      await expect(f.run()).rejects.toThrow()
      expect(f.writes).toHaveLength(0)
    }
  })

  test('checks the provider preview total instead of assuming a tax proportion', async () => {
    const f = fixture()
    f.credit.total = 595
    f.credit.total_excluding_tax = 500
    f.credit.total_taxes = [{ amount: 95 }]
    await expect(f.run()).rejects.toThrow(/refund amount/)
    expect(f.writes).toHaveLength(0)
  })

  test('rejects empty, duplicate and non-integer line amounts before provider requests', async () => {
    for (const lines of [[], [{ invoiceLineItem: 'il_sale', amount: 1.5 }], [{ invoiceLineItem: 'il_sale', amount: 500 }, { invoiceLineItem: 'il_sale', amount: 1 }]]) {
      const f = fixture()
      await expect(creditDirectInvoiceRefund('in_sale', 'acct_merchant', 're_sale', lines, f.client)).rejects.toThrow()
      expect(f.reads).toHaveLength(0)
    }
  })
})
