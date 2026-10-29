import { describe, expect, test } from 'bun:test'
import { collectDirectInvoice } from '../src/connect/invoice-collection'

function fixture() {
  let invoice: any = { id: 'in_sale', status: 'draft', auto_advance: false, customer: 'cus_buyer', parent: { subscription_details: { subscription: 'sub_sale' } }, currency: 'eur', total: 1999, total_excluding_tax: 1680, total_taxes: [{ amount: 319 }], amount_due: 1999, automatic_tax: { enabled: true, status: 'complete' }, hosted_invoice_url: 'https://invoice.stripe.com/test' }
  const intent: any = { id: 'pi_sale', customer: 'cus_buyer', currency: 'eur', amount: 1999, application_fee_amount: 168, status: 'requires_confirmation' }
  const calls: Array<{ action: string, options: any, params?: any }> = []
  const client: any = {
    invoices: {
      retrieve: async (_id: string, _params: any, options: any) => { calls.push({ action: 'retrieve', options }); return invoice },
      update: async (_id: string, params: any, options: any) => { calls.push({ action: 'update', params, options }); invoice = { ...invoice, ...params }; return invoice },
      finalizeInvoice: async (_id: string, params: any, options: any) => { calls.push({ action: 'finalize', params, options }); invoice = { ...invoice, status: invoice.total ? 'open' : 'paid' }; return invoice },
      pay: async (_id: string, params: any, options: any) => { calls.push({ action: 'pay', params, options }); invoice = { ...invoice, status: 'paid' }; intent.status = 'succeeded'; return invoice },
    },
    paymentMethods: { retrieve: async (_id: string, _params: any, options: any) => { calls.push({ action: 'method', options }); return { id: 'pm_buyer', customer: 'cus_buyer' } } },
    invoicePayments: { list: async (_params: any, options: any) => { calls.push({ action: 'attempts', options }); return { data: [{ id: 'inpay_sale', invoice: 'in_sale', status: 'open', payment: { type: 'payment_intent', payment_intent: 'pi_sale' } }], has_more: false } } },
    paymentIntents: { retrieve: async (_id: string, _params: any, options: any) => { calls.push({ action: 'intent', options }); return intent } },
  }
  const options = { customer: 'cus_buyer', subscription: 'sub_sale', currency: 'EUR', platformFeePercent: 10, approvedTotal: 1999, paymentMethod: 'pm_buyer' }
  return { client, calls, options, intent, get invoice() { return invoice }, set invoice(value: any) { invoice = value }, collect: () => collectDirectInvoice('in_sale', 'acct_merchant', options, client) }
}

describe('direct invoice collection', () => {
  test('holds the invoice, prepares an after-tax fee, then finalizes and collects the approved amount', async () => {
    const f = fixture()
    expect(await f.collect()).toMatchObject({ status: 'paid', gross: 1999, net: 1680, tax: 319, fee: 168 })
    expect(f.calls.filter(call => ['update', 'finalize', 'pay'].includes(call.action)).map(call => call.action)).toEqual(['update', 'finalize', 'pay'])
    expect(f.calls.find(call => call.action === 'pay')).toMatchObject({ params: { payment_method: 'pm_buyer', off_session: true }, options: { stripeAccount: 'acct_merchant', idempotencyKey: expect.any(String) } })
    expect(f.calls.every(call => call.options.stripeAccount === 'acct_merchant')).toBe(true)
  })

  test('rejects foreign identities, changed approval amounts and incomplete tax before collection', async () => {
    for (const change of [
      { id: 'in_foreign' }, { customer: 'cus_other' }, { currency: 'usd' }, { status: 'void' },
      { parent: null }, { total: 2000 }, { amount_due: 1800 },
      { automatic_tax: { enabled: true, status: 'requires_location_inputs' } },
    ]) {
      const f = fixture()
      f.invoice = { ...f.invoice, ...change }
      await expect(f.collect()).rejects.toThrow()
      expect(f.calls.filter(call => ['update', 'finalize', 'pay'].includes(call.action))).toEqual([])
    }
  })

  test('rejects a saved payment method belonging to another customer', async () => {
    const f = fixture()
    f.client.paymentMethods.retrieve = async () => ({ id: 'pm_buyer', customer: 'cus_other' })
    await expect(f.collect()).rejects.toThrow(/another customer/)
    expect(f.calls.some(call => call.action === 'pay')).toBe(false)
  })

  test('will not charge a finalized intent with a fee calculated on gross instead of net', async () => {
    const f = fixture()
    f.intent.application_fee_amount = 200
    await expect(f.collect()).rejects.toThrow(/after-tax fee/)
    expect(f.invoice.auto_advance).toBe(false)
    expect(f.calls.some(call => call.action === 'pay')).toBe(false)
  })

  test('holds collection if finalization changes the tax even when gross is unchanged', async () => {
    const f = fixture()
    f.client.invoices.finalizeInvoice = async () => ({ ...f.invoice, status: 'open', total_excluding_tax: 1700, total_taxes: [{ amount: 299 }] })
    await expect(f.collect()).rejects.toThrow(/tax changed/)
    expect(f.calls.some(call => call.action === 'pay')).toBe(false)
  })

  test('recovers an open invoice and replays a paid invoice without a second payment', async () => {
    const f = fixture()
    f.invoice.status = 'open'
    expect(await f.collect()).toMatchObject({ status: 'paid', paymentIntent: { status: 'succeeded' } })
    const writes = f.calls.filter(call => ['update', 'finalize', 'pay'].includes(call.action))
    expect(writes.map(call => call.action)).toEqual(['pay'])
    const count = f.calls.length
    expect(await f.collect()).toMatchObject({ status: 'paid' })
    expect(f.calls.slice(count).some(call => ['update', 'finalize', 'pay', 'method'].includes(call.action))).toBe(false)
  })

  test('finalizes a zero trial invoice without charging or requesting a payment intent', async () => {
    const f = fixture()
    f.options.approvedTotal = 0
    Object.assign(f.invoice, { total: 0, total_excluding_tax: 0, total_taxes: [], amount_due: 0 })
    expect(await f.collect()).toMatchObject({ status: 'paid', gross: 0, tax: 0, net: 0, fee: 0 })
    expect(f.calls.some(call => ['pay', 'method', 'attempts', 'intent'].includes(call.action))).toBe(false)
  })

  test('returns customer action after a card failure and propagates network failures for durable retry', async () => {
    const f = fixture()
    f.client.invoices.pay = async () => { f.intent.status = 'requires_action'; throw { type: 'StripeCardError' } }
    expect(await f.collect()).toMatchObject({ status: 'requires_payment', paymentUrl: 'https://invoice.stripe.com/test' })
    f.intent.status = 'requires_confirmation'
    f.client.invoices.pay = async () => { throw new Error('provider unavailable') }
    await expect(f.collect()).rejects.toThrow('provider unavailable')
  })

  test('does not issue a payment while Stripe is processing it or awaiting customer action', async () => {
    for (const status of ['processing', 'requires_action']) {
      const f = fixture()
      f.invoice.status = 'open'
      f.intent.status = status
      expect((await f.collect()).status).toBe(status === 'processing' ? 'processing' : 'requires_payment')
      expect(f.calls.some(call => call.action === 'pay')).toBe(false)
    }
  })

  test('refuses ambiguous or foreign invoice payments', async () => {
    for (const rows of [[], [{ id: 'inpay_other', invoice: 'in_foreign', status: 'open', payment: { type: 'payment_intent', payment_intent: 'pi_sale' } }], [
      { id: 'inpay_one', invoice: 'in_sale', status: 'open', payment: { type: 'payment_intent', payment_intent: 'pi_sale' } },
      { id: 'inpay_two', invoice: 'in_sale', status: 'open', payment: { type: 'payment_intent', payment_intent: 'pi_other' } },
    ]]) {
      const f = fixture()
      f.client.invoicePayments.list = async () => ({ data: rows, has_more: false })
      await expect(f.collect()).rejects.toThrow(/canonical invoice payment/)
      expect(f.calls.some(call => call.action === 'pay')).toBe(false)
    }
  })

  test('pauses an open invoice before reading payment credentials', async () => {
    const f = fixture()
    Object.assign(f.invoice, { status: 'open', auto_advance: true })
    await f.collect()
    expect(f.calls[1]).toMatchObject({ action: 'update', params: { auto_advance: false } })
    expect(f.calls[2].action).toBe('method')
  })
})
