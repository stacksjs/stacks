import { expect, test } from 'bun:test'
import { ensureDirectInvoicePrice } from '../src/connect/invoice-price'
import type { DirectInvoicePriceOptions } from '../src/connect/invoice-price'

function fixture() {
  let stored: any
  const calls: any[] = []
  const options: DirectInvoicePriceOptions = { reference: 'offer:running:v1', name: 'Running', amount: 1999, currency: 'EUR', taxCode: 'txcd_10000000', interval: 'month' }
  const client: any = { prices: {
    list: async (params: any, request: any) => { calls.push({ action: 'list', params, request }); return { data: stored?.lookup_key === params.lookup_keys[0] ? [stored] : [], has_more: false } },
    create: async (params: any, request: any) => {
      calls.push({ action: 'create', params, request })
      stored = { id: `price_running_${calls.filter(call => call.action === 'create').length}`, active: true, type: params.recurring ? 'recurring' : 'one_time', currency: params.currency, unit_amount: params.unit_amount, tax_behavior: params.tax_behavior, lookup_key: params.lookup_key, metadata: params.metadata, recurring: params.recurring ? { ...params.recurring, usage_type: 'licensed' } : null, product: { id: 'prod_running', active: true, name: params.product_data.name, tax_code: params.product_data.tax_code } }
      return stored
    },
    retrieve: async (_id: string, params: any, request: any) => { calls.push({ action: 'retrieve', params, request }); return stored },
  } }
  return { client, calls, options, get stored() { return stored }, ensure: () => ensureDirectInvoicePrice('acct_merchant', options, client) }
}

test('reuses an inclusive merchant catalog price with a durable provider lookup key', async () => {
  const f = fixture()
  expect((await f.ensure()).id).toBe('price_running_1')
  expect((await f.ensure()).id).toBe('price_running_1')
  const creates = f.calls.filter(call => call.action === 'create')
  expect(creates).toHaveLength(1)
  expect(creates[0]).toMatchObject({ params: { currency: 'eur', unit_amount: 1999, tax_behavior: 'inclusive', product_data: { name: 'Running', tax_code: 'txcd_10000000' }, recurring: { interval: 'month', interval_count: 1 } }, request: { stripeAccount: 'acct_merchant', idempotencyKey: expect.any(String) } })
  expect(f.calls.every(call => call.request.stripeAccount === 'acct_merchant')).toBe(true)
})

test('finds the original price after a lost create response, without another create', async () => {
  const f = fixture()
  const create = f.client.prices.create
  f.client.prices.create = async (...args: any[]) => { await create(...args); throw new Error('response lost') }
  await expect(f.ensure()).rejects.toThrow('response lost')
  expect((await f.ensure()).id).toBe('price_running_1')
  expect(f.calls.filter(call => call.action === 'create')).toHaveLength(1)
})

test('a changed price receives a new lookup key while the old price remains untouched', async () => {
  const f = fixture()
  const original = await f.ensure()
  f.options.amount = 2999
  const next = await f.ensure()
  expect(next.id).not.toBe(original.id)
  expect(next.lookup_key).not.toBe(original.lookup_key)
  expect(original.unit_amount).toBe(1999)
  expect(next.unit_amount).toBe(2999)
})

test('supports a one-time offer without recurring fields', async () => {
  const f = fixture()
  delete f.options.interval
  expect(await f.ensure()).toMatchObject({ type: 'one_time', recurring: null, tax_behavior: 'inclusive' })
  expect(f.calls.find(call => call.action === 'create').params.recurring).toBeUndefined()
})

test('refuses inactive, foreign or modified provider prices without creating replacements', async () => {
  for (const change of [{ active: false }, { unit_amount: 2000 }, { currency: 'usd' }, { tax_behavior: 'exclusive' }, { metadata: {} }, { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } }]) {
    const f = fixture()
    await f.ensure()
    Object.assign(f.stored, change)
    await expect(f.ensure()).rejects.toThrow(/frozen inclusive offer/)
    expect(f.calls.filter(call => call.action === 'create')).toHaveLength(1)
  }
  const f = fixture()
  await f.ensure()
  f.stored.product.tax_code = 'txcd_20030000'
  await expect(f.ensure()).rejects.toThrow(/frozen inclusive offer/)
})

test('validates offer inputs before calling Stripe', async () => {
  for (const change of [{ reference: undefined }, { reference: '' }, { name: '' }, { amount: 0 }, { amount: -1 }, { amount: 19.99 }, { currency: 'euro' }, { taxCode: 'guessed-rate' }, { intervalCount: 0 }, { interval: 'quarter' }]) {
    const f = fixture()
    Object.assign(f.options, change)
    await expect(f.ensure()).rejects.toThrow()
    expect(f.calls).toEqual([])
  }
})
