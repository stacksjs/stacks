import { afterEach, expect, setSystemTime, test } from 'bun:test'
import { completeDirectInvoicePurchase, DirectInvoicePurchaseExpiredError, directInvoicePurchaseMetadata } from '../src/connect/invoice-purchase'
import type { DirectInvoicePurchaseOptions } from '../src/connect/invoice-purchase'

afterEach(() => setSystemTime())

function fixture(recurring = false, trialDays = 0) {
  const options: DirectInvoicePurchaseOptions = { reference: 'purchase:one', customer: 'cus_buyer', price: 'price_sale', expiresAt: Math.floor(Date.now() / 1000) + 3600, amount: 1999, currency: 'EUR', taxCode: 'txcd_10000000', platformFeePercent: 10, metadata: { order_id: '1' } }
  if (recurring) Object.assign(options, { interval: 'month', trialDays })
  const calls: any[] = []
  let invoice: any
  const lines: any[] = []
  let schedule: any
  const subscription: any = { id: 'sub_sale', customer: 'cus_buyer', status: trialDays ? 'trialing' : 'active', trial_end: trialDays ? 1800000000 : null, items: { data: [{ price: 'price_sale', quantity: 1 }], has_more: false }, schedule: 'sub_sched_sale' }
  const setup: any = { id: 'seti_sale', created: Math.floor(Date.now() / 1000), status: 'succeeded', usage: 'off_session', customer: 'cus_buyer', payment_method: 'pm_buyer', metadata: directInvoicePurchaseMetadata('acct_merchant', options) }
  const intent: any = { id: 'pi_sale', customer: 'cus_buyer', currency: 'eur', amount: 1999, status: 'requires_confirmation', application_fee_amount: 168 }
  const makeInvoice = (params: any, sub = false) => {
    invoice = { ...params, id: 'in_sale', status: 'draft', parent: sub ? { subscription_details: { subscription: 'sub_sale', metadata: subscription.metadata } } : null, billing_reason: sub ? 'subscription_create' : 'manual', currency: 'eur', total: 0, total_excluding_tax: 0, total_taxes: [], amount_due: 0, automatic_tax: { enabled: true, status: 'complete' }, hosted_invoice_url: 'https://invoice.stripe.com/test' }
    return invoice
  }
  const client: any = {
    setupIntents: { retrieve: async () => setup },
    prices: { retrieve: async () => ({ id: 'price_sale', type: recurring ? 'recurring' : 'one_time', active: true, currency: 'eur', unit_amount: 1999, tax_behavior: 'inclusive', recurring: recurring ? { interval: 'month', interval_count: 1, usage_type: 'licensed' } : null, product: { id: 'prod_sale', active: true, tax_code: 'txcd_10000000' } }) },
    paymentMethods: { retrieve: async () => ({ id: 'pm_buyer', customer: 'cus_buyer' }) },
    invoices: {
      list: async () => ({ data: invoice ? [invoice] : [], has_more: false }),
      create: async (params: any, request: any) => { calls.push({ action: 'create', params, request }); return makeInvoice(params) },
      retrieve: async () => invoice,
      listLineItems: async () => ({ data: lines, has_more: false }),
      update: async (_id: string, params: any) => { calls.push({ action: 'update', params }); invoice = { ...invoice, ...params }; return invoice },
      finalizeInvoice: async () => { invoice.status = invoice.total ? 'open' : 'paid'; return invoice },
      pay: async () => { calls.push({ action: 'pay' }); invoice.status = 'paid'; intent.status = 'succeeded'; return invoice },
    },
    invoiceItems: { create: async (params: any, request: any) => { calls.push({ action: 'line', params, request }); lines.push({ id: 'il_sale', quantity: 1, pricing: { price_details: { price: params.pricing.price } } }); Object.assign(invoice, { total: 1999, total_excluding_tax: 1680, total_taxes: [{ amount: 319 }], amount_due: 1999 }); return lines[0] } },
    invoicePayments: { list: async () => ({ data: [{ id: 'inpay_sale', invoice: 'in_sale', status: invoice?.status === 'paid' ? 'paid' : 'open', payment: { type: 'payment_intent', payment_intent: 'pi_sale' } }], has_more: false }) },
    paymentIntents: { retrieve: async () => intent },
    subscriptionSchedules: {
      list: async () => ({ data: schedule ? [schedule] : [], has_more: false }),
      create: async (params: any, request: any) => {
        calls.push({ action: 'schedule', params, request })
        schedule = { id: 'sub_sched_sale', customer: 'cus_buyer', status: 'active', metadata: params.metadata, subscription: 'sub_sale', released_subscription: null }
        subscription.metadata = params.phases[0].metadata
        makeInvoice({ customer: 'cus_buyer', auto_advance: true, metadata: {} }, true)
        lines.push({ id: 'il_sale', quantity: 1, pricing: { price_details: { price: 'price_sale' } } })
        if (!trialDays) Object.assign(invoice, { total: 1999, total_excluding_tax: 1680, total_taxes: [{ amount: 319 }], amount_due: 1999 })
        return schedule
      },
      release: async () => { calls.push({ action: 'release' }); schedule.status = 'released'; schedule.subscription = null; schedule.released_subscription = 'sub_sale'; subscription.schedule = null; return schedule },
    },
    subscriptions: { retrieve: async () => subscription },
  }
  return { options, setup, calls, client, subscription, get schedule() { return schedule }, get invoice() { return invoice }, complete: () => completeDirectInvoicePurchase('seti_sale', 'acct_merchant', options, client) }
}

test('a verified setup creates one invoice purchase and recovers it on replay', async () => {
  const f = fixture()
  expect(await f.complete()).toMatchObject({ status: 'paid', gross: 1999, tax: 319, fee: 168 })
  expect(await f.complete()).toMatchObject({ status: 'paid', invoice: { id: 'in_sale' } })
  expect(f.calls.filter(call => call.action === 'create')).toHaveLength(1)
  expect(f.calls.filter(call => call.action === 'line')).toHaveLength(1)
  expect(f.calls.filter(call => call.action === 'pay')).toHaveLength(1)
  expect(f.calls.find(call => call.action === 'create')).toMatchObject({ params: { auto_advance: false, automatic_tax: { enabled: true }, pending_invoice_items_behavior: 'exclude', metadata: { stacks_purchase_setup: 'seti_sale' } }, request: { stripeAccount: 'acct_merchant' } })
})

test.each([0, 90])('creates and releases one subscription while preserving a %s-day native trial', async (days) => {
  const f = fixture(true, days)
  expect(await f.complete()).toMatchObject({ status: 'paid', gross: days ? 0 : 1999, subscription: { id: 'sub_sale', status: days ? 'trialing' : 'active', schedule: null } })
  expect(await f.complete()).toMatchObject({ status: 'paid', subscription: { id: 'sub_sale' } })
  expect(f.calls.filter(call => call.action === 'schedule')).toHaveLength(1)
  expect(f.calls.filter(call => call.action === 'release')).toHaveLength(1)
  expect(f.calls.filter(call => call.action === 'pay')).toHaveLength(days ? 0 : 1)
  const phases = f.calls.find(call => call.action === 'schedule').params.phases
  if (days) {
    expect(phases).toHaveLength(2)
    expect(phases[0]).toMatchObject({ trial: true, duration: { interval: 'day', interval_count: days } })
    expect(f.subscription.trial_end).toBe(1800000000)
  }
  const release = f.calls.findIndex(call => call.action === 'release')
  expect(f.calls.slice(0, release).some(call => call.action === 'update' && call.params.auto_advance === false)).toBe(true)
})

test.each(['invoice', 'line', 'schedule'])('recovers a lost %s creation response without another purchase', async (stage) => {
  const f = fixture(stage === 'schedule')
  const resource = stage === 'invoice' ? f.client.invoices : stage === 'line' ? f.client.invoiceItems : f.client.subscriptionSchedules
  const create = resource.create
  resource.create = async (...args: any[]) => { await create(...args); throw new Error('create response lost') }
  await expect(f.complete()).rejects.toThrow('create response lost')
  expect(await f.complete()).toMatchObject({ status: 'paid', invoice: { id: 'in_sale' } })
  expect(f.calls.filter(call => call.action === (stage === 'invoice' ? 'create' : stage))).toHaveLength(1)
  expect(f.calls.filter(call => call.action === 'pay')).toHaveLength(1)
})

test.each([false, true])('expired quotes recover paid purchases but cannot create replacements (subscription=%s)', async (recurring) => {
  const f = fixture(recurring)
  await f.complete()
  setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000))
  f.client.prices.retrieve = async () => { throw new Error('product archived') }
  f.client.paymentMethods.retrieve = async () => { throw new Error('saved method detached') }
  expect((await f.complete()).status).toBe('paid')
  expect(f.calls.filter(call => call.action === 'pay')).toHaveLength(1)
  // If an operator removes the recovery binding, a pruned idempotency key
  // must never permit a second purchase under the same old approval.
  if (recurring) f.schedule.metadata = {}
  else f.invoice.metadata = {}
  await expect(f.complete()).rejects.toThrow(/Expired purchase/)
  expect(f.calls.filter(call => ['create', 'schedule'].includes(call.action))).toHaveLength(1)
})

test('refuses new purchases after quote expiry or provider idempotency retention', async () => {
  for (const oldSetup of [false, true]) {
    const f = fixture()
    if (oldSetup) f.setup.created -= 25 * 60 * 60
    else {
      f.options.expiresAt = Math.floor(Date.now() / 1000) - 1
      f.setup.metadata = directInvoicePurchaseMetadata('acct_merchant', f.options)
    }
    await expect(f.complete()).rejects.toThrow(DirectInvoicePurchaseExpiredError)
    expect(f.calls).toEqual([])
  }
})

test.each([false, true])('expired quotes with unbound customer resources need review (subscription=%s)', async recurring => {
  const f = fixture(recurring)
  f.setup.created -= 25 * 60 * 60
  const resource = recurring ? f.client.subscriptionSchedules : f.client.invoices
  resource.list = async () => ({ data: [{ id: recurring ? 'sub_sched_unbound' : 'in_unbound', metadata: {} }], has_more: false })
  try {
    await f.complete()
    throw new Error('Expected review of an uncertain expired purchase')
  }
  catch (error) {
    expect(error).not.toBeInstanceOf(DirectInvoicePurchaseExpiredError)
    expect(String(error)).toContain('review of unbound original-customer resources')
  }
  expect(f.calls).toEqual([])
})

test('refuses foreign, incomplete and changed setup approvals before purchase writes', async () => {
  for (const change of [{ id: 'seti_other' }, { status: 'processing' }, { status: 'canceled' }, { usage: 'on_session' }, { customer: 'cus_other' }, { payment_method: null }, { metadata: {} }]) {
    const f = fixture()
    Object.assign(f.setup, change)
    await expect(f.complete()).rejects.toThrow(/Payment setup/)
    expect(f.calls).toEqual([])
  }
  const f = fixture()
  f.options.platformFeePercent = 20
  await expect(f.complete()).rejects.toThrow(/frozen quote/)
  expect(f.calls).toEqual([])
})

test('another setup cannot reuse an already bound purchase reference', async () => {
  const f = fixture()
  await f.complete()
  f.setup.id = 'seti_another'
  await expect(completeDirectInvoicePurchase('seti_another', 'acct_merchant', f.options, f.client)).rejects.toThrow(/different provider bindings/)
  expect(f.calls.filter(call => call.action === 'create')).toHaveLength(1)
})

test('refuses duplicated recovery bindings and changed invoice lines', async () => {
  const f = fixture()
  await f.complete()
  f.client.invoices.list = async () => ({ data: [f.invoice, { ...f.invoice, id: 'in_duplicate' }], has_more: false })
  await expect(f.complete()).rejects.toThrow(/ambiguous/)
  f.client.invoices.list = async () => ({ data: [f.invoice], has_more: false })
  f.client.invoices.listLineItems = async () => ({ data: [{ id: 'il_other', quantity: 1, pricing: { price_details: { price: 'price_other' } } }], has_more: false })
  await expect(f.complete()).rejects.toThrow(/different catalog lines/)
  expect(f.calls.filter(call => call.action === 'pay')).toHaveLength(1)
})

test('a subscription replay selects the original invoice after renewals exist', async () => {
  const f = fixture(true)
  await f.complete()
  f.client.invoices.list = async () => ({ data: [{ ...f.invoice, id: 'in_renewal', billing_reason: 'subscription_cycle' }, f.invoice], has_more: false })
  const retrieve = f.client.invoices.retrieve
  f.client.invoices.retrieve = async (invoiceId: string) => {
    if (invoiceId !== 'in_sale') throw new Error('Selected a renewal as the first purchase')
    return retrieve()
  }
  expect((await f.complete()).status).toBe('paid')
  expect(f.calls.filter(call => call.action === 'pay')).toHaveLength(1)
})

test('rejects invalid quote terms and caller metadata that overwrites purchase bindings', () => {
  const f = fixture()
  for (const change of [{ expiresAt: 0 }, { amount: 0 }, { taxCode: '' }, { intervalCount: 2 }, { trialDays: 1 }, { metadata: { stacks_purchase_quote: 'forged' } }, { metadata: [] }])
    expect(() => directInvoicePurchaseMetadata('acct_merchant', { ...f.options, ...change } as any)).toThrow()
})

test('does not collect a recovered invoice after its automatic tax policy was disabled', async () => {
  const f = fixture()
  const addLine = f.client.invoiceItems.create
  f.client.invoiceItems.create = async (...args: any[]) => { await addLine(...args); throw new Error('line response lost') }
  await expect(f.complete()).rejects.toThrow('line response lost')
  f.invoice.automatic_tax.enabled = false
  await expect(f.complete()).rejects.toThrow(/automatic tax policy/)
  expect(f.calls.some(call => call.action === 'pay')).toBe(false)
})
