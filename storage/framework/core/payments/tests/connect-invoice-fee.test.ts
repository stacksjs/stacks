import { describe, expect, test } from 'bun:test'
import { prepareDirectInvoiceFee } from '../src/connect/invoice-fee'

function fixture() {
  const invoice: any = { id: 'in_sale', status: 'draft', customer: 'cus_buyer', parent: { subscription_details: { subscription: 'sub_sale' } }, currency: 'eur', total: 1999, total_excluding_tax: 1680, total_taxes: [{ amount: 319 }], amount_due: 1999, automatic_tax: { enabled: true, status: 'complete' } }
  const writes: any[] = []
  const calls: any[] = []
  const client: any = { invoices: {
    retrieve: async (id: string, params: any, options: any) => { calls.push({ id, params, options }); return invoice },
    update: async (id: string, params: any, options: any) => { writes.push({ id, params, options }); return invoice },
  } }
  const options = { customer: 'cus_buyer', subscription: 'sub_sale', currency: 'EUR', platformFeePercent: 10 }
  return { invoice, writes, calls, client, options, prepare: () => prepareDirectInvoiceFee('in_sale', 'acct_merchant', options, client) }
}

describe('direct invoice fees after tax', () => {
  test('uses canonical tax-exclusive invoice value and holds collection before returning', async () => {
    const f = fixture()
    const result = await f.prepare()
    expect(result).toMatchObject({ gross: 1999, tax: 319, net: 1680, fee: 168, currency: 'EUR' })
    expect(f.calls[0].options.stripeAccount).toBe('acct_merchant')
    expect(f.writes).toHaveLength(1)
    expect(f.writes[0]).toMatchObject({ id: 'in_sale', params: { auto_advance: false, application_fee_amount: 168 }, options: { stripeAccount: 'acct_merchant' } })
    expect(f.writes[0].options.idempotencyKey).toBeTruthy()
  })

  test('preserves zero-tax and fee-free contracts', async () => {
    const f = fixture()
    f.invoice.total_excluding_tax = 1999
    f.invoice.total_taxes = []
    f.options.platformFeePercent = 0
    expect(await f.prepare()).toMatchObject({ tax: 0, net: 1999, fee: 0 })
    expect(f.writes[0].params.application_fee_amount).toBe(0)
  })

  test('does not turn an incomplete calculation into zero tax or write to finalized/foreign invoices', async () => {
    for (const change of [
      { automatic_tax: { enabled: true, status: 'requires_location_inputs' } },
      { total_excluding_tax: null }, { total_excluding_tax: 2000 }, { total_taxes: [{ amount: 320 }] },
      { id: 'in_foreign' }, { customer: 'cus_foreign' }, { currency: 'usd' },
      { parent: { subscription_details: { subscription: 'sub_foreign' } } },
      { status: 'open' }, { status: 'paid' }, { amount_due: 1500 },
    ]) {
      const f = fixture()
      Object.assign(f.invoice, change)
      await expect(f.prepare()).rejects.toThrow()
      expect(f.writes).toHaveLength(0)
    }
  })

  test('rejects invalid fee input before a provider request', async () => {
    for (const percent of [-1, 101, 1.001, Number.NaN]) {
      const f = fixture()
      f.options.platformFeePercent = percent
      await expect(f.prepare()).rejects.toThrow()
      expect(f.calls).toHaveLength(0)
    }
  })

  test('detects provider tax/amount changes while applying the fee', async () => {
    const f = fixture()
    f.client.invoices.update = async (_id: string, params: any) => {
      expect(params.auto_advance).toBe(false)
      return { ...f.invoice, total_excluding_tax: 1700, total_taxes: [{ amount: 299 }] }
    }
    await expect(f.prepare()).rejects.toThrow(/changed/)
  })
})
