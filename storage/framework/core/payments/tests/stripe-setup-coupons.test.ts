import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

// `buddy stripe:setup` now provisions what `config/saas.ts` declares beyond
// plans: coupons with the codes customers type, and the customer portal. The
// config had a `coupons` key all along that nothing read. These run the
// reconciler against a fake account, so a re-run, a changed coupon and a
// shared account (one portal configuration per app) are covered offline.

const account: { products: any[], prices: any[], coupons: any[], promotionCodes: any[], portals: any[] } = { products: [], prices: [], coupons: [], promotionCodes: [], portals: [] }
const writes: { coupons: any[], promotionCodes: any[], portalCreates: any[], portalUpdates: any[] } = { coupons: [], promotionCodes: [], portalCreates: [], portalUpdates: [] }

function iterate<T>(items: T[]) {
  return { async* [Symbol.asyncIterator]() { yield* items } }
}

const stripe = {
  products: {
    list: () => iterate(account.products.filter(p => p.active)),
    async create(params: any) {
      const product = { id: `prod_${account.products.length + 1}`, name: params.name, active: true }
      account.products.push(product)
      return product
    },
  },
  prices: {
    async list(params: { lookup_keys?: string[] }) {
      return { data: account.prices.filter(p => p.lookup_key === params.lookup_keys?.[0]) }
    },
    async create(params: any) {
      const price = { id: `price_${account.prices.length + 1}`, ...params, active: true }
      account.prices.push(price)
      return price
    },
  },
  coupons: {
    async retrieve(id: string) {
      const coupon = account.coupons.find(c => c.id === id)
      if (!coupon)
        throw Object.assign(new Error(`No such coupon: '${id}'`), { statusCode: 404, code: 'resource_missing' })
      return coupon
    },
    async create(params: any) {
      writes.coupons.push(params)
      const coupon = { percent_off: null, amount_off: null, duration_in_months: null, ...params }
      account.coupons.push(coupon)
      return coupon
    },
  },
  promotionCodes: {
    async list(params: { code: string }) {
      return { data: account.promotionCodes.filter(p => p.code === params.code && p.active) }
    },
    async create(params: any) {
      writes.promotionCodes.push(params)
      const promo = { id: `promo_${account.promotionCodes.length + 1}`, code: params.code, active: true, promotion: params.promotion }
      account.promotionCodes.push(promo)
      return promo
    },
  },
  billingPortal: {
    configurations: {
      list: () => iterate(account.portals.filter(p => p.active)),
      async create(params: any) {
        writes.portalCreates.push(params)
        const config = { id: `bpc_${account.portals.length + 1}`, active: true, ...toLive(params) }
        account.portals.push(config)
        return config
      },
      async update(id: string, params: any) {
        writes.portalUpdates.push({ id, params })
        const config = account.portals.find(p => p.id === id)
        Object.assign(config, toLive(params))
        return config
      },
    },
  },
}

/** What Stripe hands back for a configuration created with `params`. */
function toLive(params: any) {
  return {
    features: {
      invoice_history: params.features.invoice_history,
      payment_method_update: params.features.payment_method_update,
      customer_update: params.features.customer_update,
      subscription_cancel: { mode: 'at_period_end', ...params.features.subscription_cancel },
    },
    default_return_url: params.default_return_url ?? null,
    business_profile: { headline: params.business_profile?.headline ?? null },
    metadata: params.metadata,
  }
}

const saas: any = {
  plans: [
    { productName: 'App Monthly', description: 'm', pricing: [{ key: 'app_monthly', price: 199, interval: 'month', currency: 'usd' }], metadata: { createdBy: 't', version: '1' } },
    { productName: 'App Lifetime', description: 'l', pricing: [{ key: 'app_lifetime', price: 2999, currency: 'usd' }], metadata: { createdBy: 't', version: '1' } },
  ],
  coupons: [
    { id: 'six_months_free', name: '6 months free', percentOff: 100, duration: 'repeating', durationInMonths: 6, appliesTo: ['App Monthly'], codes: ['SIXFREE'] },
  ],
  portal: { headline: 'Manage App', returnUrl: 'https://app.example/account', cancel: 'at_period_end' },
}

// Spread, and put back afterwards: `mock.module` is process-global in Bun and
// never rolled back (stacksjs/stacks#2413).
const actualLogging = { ...await import('@stacksjs/logging') }
const actualConfig = { ...await import('@stacksjs/config') }
const actualPayments = { ...await import('@stacksjs/payments') }
const silentLog = Object.fromEntries(Object.keys(actualLogging.log).map(method => [method, () => {}])) as typeof actualLogging.log

mock.module('@stacksjs/logging', () => ({ ...actualLogging, log: silentLog }))
mock.module('@stacksjs/config', () => ({ ...actualConfig, saas, app: { ...actualConfig.app, name: 'App' } }))
mock.module('@stacksjs/payments', () => ({ ...actualPayments, stripe }))

afterAll(() => {
  mock.module('@stacksjs/logging', () => actualLogging)
  mock.module('@stacksjs/config', () => actualConfig)
  mock.module('@stacksjs/payments', () => actualPayments)
})

const { createStripeProduct, formatSetupReport } = await import('../src/billable/setup-products')

function reset() {
  for (const key of Object.keys(account) as (keyof typeof account)[])
    account[key] = []
  for (const key of Object.keys(writes) as (keyof typeof writes)[])
    writes[key] = []
}

async function run(dryRun = false) {
  const result = await createStripeProduct({ dryRun })
  if (result.isErr)
    throw result.error
  return result.value.actions
}

describe('stripe:setup coupons', () => {
  beforeEach(reset)

  it('creates the coupon, restricted to the plans it names, and its codes', async () => {
    const actions = await run()
    expect(writes.coupons).toEqual([{
      id: 'six_months_free',
      name: '6 months free',
      percent_off: 100,
      duration: 'repeating',
      duration_in_months: 6,
      applies_to: { products: ['prod_1'] },
    }])
    expect(writes.promotionCodes).toEqual([{ promotion: { type: 'coupon', coupon: 'six_months_free' }, code: 'SIXFREE' }])
    expect(actions.filter(a => a.kind === 'coupon' || a.kind === 'promotion-code').map(a => `${a.kind}:${a.verb}`)).toEqual(['coupon:create', 'promotion-code:create'])
  })

  it('writes nothing the second time', async () => {
    await run()
    const coupons = writes.coupons.length
    const codes = writes.promotionCodes.length
    const actions = await run()
    expect(writes.coupons).toHaveLength(coupons)
    expect(writes.promotionCodes).toHaveLength(codes)
    expect(actions.filter(a => a.kind !== 'product' && a.kind !== 'price').every(a => a.verb === 'reuse')).toBe(true)
  })

  it('reports a coupon that differs instead of deleting it, which would void its codes', async () => {
    account.coupons.push({ id: 'six_months_free', percent_off: 50, amount_off: null, duration: 'repeating', duration_in_months: 6 })
    const actions = await run()
    expect(actions.find(a => a.kind === 'coupon')).toMatchObject({ verb: 'conflict', target: 'six_months_free' })
    expect(writes.coupons).toHaveLength(0)
    expect(writes.promotionCodes).toHaveLength(0)
  })

  it('will not hand a code that belongs to another coupon to this one', async () => {
    account.promotionCodes.push({ id: 'promo_x', code: 'SIXFREE', active: true, promotion: { type: 'coupon', coupon: 'someone_elses' } })
    const actions = await run()
    expect(actions.find(a => a.kind === 'promotion-code')).toMatchObject({ verb: 'conflict', target: 'SIXFREE' })
    expect(writes.promotionCodes).toHaveLength(0)
  })

  it('writes nothing on a dry run', async () => {
    const actions = await run(true)
    expect(writes.coupons).toHaveLength(0)
    expect(writes.promotionCodes).toHaveLength(0)
    expect(writes.portalCreates).toHaveLength(0)
    expect(actions.map(a => `${a.kind}:${a.verb}`)).toContain('coupon:create')
    expect(formatSetupReport({ dryRun: true, actions }).some(line => line.includes('promotion-code "SIXFREE" creates'))).toBe(true)
  })
})

describe('stripe:setup customer portal', () => {
  beforeEach(reset)

  it('creates one configuration, tagged as this app\'s, with cancel at period end', async () => {
    await run()
    expect(writes.portalCreates).toHaveLength(1)
    expect(writes.portalCreates[0]).toMatchObject({
      features: {
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ['email'] },
      },
      business_profile: { headline: 'Manage App' },
      default_return_url: 'https://app.example/account',
      metadata: { managed_by: 'stacks', stacks_app: 'App' },
    })
    await run()
    expect(writes.portalCreates).toHaveLength(1)
    expect(writes.portalUpdates).toHaveLength(0)
  })

  it('leaves another app\'s configuration in a shared account alone', async () => {
    account.portals.push({ id: 'bpc_other', active: true, ...toLive({ features: { invoice_history: { enabled: false }, payment_method_update: { enabled: false }, customer_update: { enabled: false }, subscription_cancel: { enabled: false } }, metadata: { managed_by: 'stacks', stacks_app: 'Other' } }) })
    await run()
    expect(writes.portalUpdates).toHaveLength(0)
    expect(writes.portalCreates).toHaveLength(1)
  })

  it('updates its own configuration when the config changes', async () => {
    await run()
    saas.portal = { ...saas.portal, cancel: 'immediately' }
    try {
      const actions = await run()
      expect(actions.find(a => a.kind === 'portal')).toMatchObject({ verb: 'update' })
      expect(writes.portalUpdates[0].params.features.subscription_cancel).toEqual({ enabled: true, mode: 'immediately' })
    }
    finally {
      saas.portal = { ...saas.portal, cancel: 'at_period_end' }
    }
  })
})
