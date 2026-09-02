import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

// stacksjs/stacks#2359 — `buddy stripe:setup` created unconditionally, so a
// second run left a duplicate product behind and then failed on prices.create
// (a lookup key belongs to one active price). Its advertised `--dry-run` wrote
// real billing objects. These drive the reconciler against a fake account so
// re-running, changing a price, and previewing are all covered without touching
// Stripe.

interface FakeProduct { id: string, name: string, active: boolean }
interface FakePrice {
  id: string
  product: string
  unit_amount: number
  currency: string
  lookup_key: string
  active: boolean
  recurring?: { interval: string }
}

const account: { products: FakeProduct[], prices: FakePrice[] } = { products: [], prices: [] }
const writes: { products: any[], prices: any[] } = { products: [], prices: [] }

const stripe = {
  products: {
    list(_params: unknown) {
      return {
        async* [Symbol.asyncIterator]() {
          for (const p of account.products) {
            if (p.active)
              yield p
          }
        },
      }
    },
    async create(params: any) {
      writes.products.push(params)
      const product: FakeProduct = { id: `prod_${account.products.length + 1}`, name: params.name, active: true }
      account.products.push(product)
      return product
    },
  },
  prices: {
    async list(params: { lookup_keys?: string[] }) {
      const key = params.lookup_keys?.[0]
      return { data: account.prices.filter(p => p.active && p.lookup_key === key) }
    },
    async create(params: any) {
      writes.prices.push(params)
      if (params.transfer_lookup_key) {
        for (const p of account.prices) {
          if (p.lookup_key === params.lookup_key)
            p.lookup_key = ''
        }
      }
      const price: FakePrice = {
        id: `price_${account.prices.length + 1}`,
        product: params.product,
        unit_amount: params.unit_amount,
        currency: params.currency,
        lookup_key: params.lookup_key,
        active: true,
        recurring: params.recurring,
      }
      account.prices.push(price)
      return price
    },
  },
}

const plans = [{
  productName: 'Test Hobby',
  description: 'A plan',
  pricing: [{ key: 'hobby_monthly', price: 1900, interval: 'month' as const, currency: 'usd' }],
  metadata: { createdBy: 'test', version: '1.0.0' },
}]

/*
 * Every mock below spreads the module it stands in for.
 *
 * `mock.module` is process-global in Bun and is never rolled back, so whatever
 * these leave behind is what every test file that runs after this one imports.
 * The logging mock used to supply four methods where `log` has sixteen, and the
 * config mock a single key where the module has dozens - so a later file
 * calling `log.success(...)` got "log.success is not a function", and
 * `deploy-env.test.ts` failed seven tests that pass on their own
 * (stacksjs/stacks#2413).
 *
 * Spreading keeps the replacement a faithful stand-in: silence the output this
 * file does not want, override the data it needs, leave the rest alone.
 */
const actualLogging = { ...await import('@stacksjs/logging') }
const actualConfig = { ...await import('@stacksjs/config') }
const actualPayments = { ...await import('@stacksjs/payments') }

const silentLog = Object.fromEntries(
  Object.keys(actualLogging.log).map(method => [method, () => {}]),
) as typeof actualLogging.log

mock.module('@stacksjs/logging', () => ({ ...actualLogging, log: silentLog }))
mock.module('@stacksjs/config', () => ({ ...actualConfig, saas: { plans } }))
mock.module('@stacksjs/payments', () => ({ ...actualPayments, stripe }))

/*
 * Put all three back when this file is done.
 *
 * Spreading fixes the SHAPE of a replacement - `log.success` exists again - but
 * the replacement is still in place for every file that runs afterwards, and a
 * silent `log` is exactly what `core/logging`'s own suite must not be handed:
 * it asserts on what gets emitted, so 54 of its tests failed with the mock
 * still installed. Shape and lifetime are separate problems and both need
 * solving (stacksjs/stacks#2413).
 */
afterAll(() => {
  mock.module('@stacksjs/logging', () => actualLogging)
  mock.module('@stacksjs/config', () => actualConfig)
  mock.module('@stacksjs/payments', () => actualPayments)
})

const { createStripeProduct, formatSetupReport } = await import('../src/billable/setup-products')

beforeEach(() => {
  account.products = []
  account.prices = []
  writes.products = []
  writes.prices = []
})

describe('createStripeProduct', () => {
  it('provisions a clean account', async () => {
    const result = await createStripeProduct()
    expect(result.isErr).toBeFalsy()
    expect(result.value.actions).toEqual([
      { kind: 'product', verb: 'create', target: 'Test Hobby' },
      { kind: 'price', verb: 'create', target: 'hobby_monthly' },
    ])
    expect(writes.products.length).toBe(1)
    expect(writes.prices.length).toBe(1)
  })

  // The whole point: this is the command people re-run.
  it('is idempotent, so a second run writes nothing', async () => {
    await createStripeProduct()
    writes.products = []
    writes.prices = []

    const second = await createStripeProduct()
    expect(second.value.actions.map(a => a.verb)).toEqual(['reuse', 'reuse'])
    expect(writes.products).toEqual([])
    expect(writes.prices).toEqual([])
    expect(account.products.length).toBe(1)
    expect(account.prices.filter(p => p.active).length).toBe(1)
  })

  // Prices are immutable in Stripe, so a changed amount cannot be edited. The
  // lookup key moves to a new price and the old one stays active but unkeyed,
  // so subscriptions already on it keep billing.
  it('moves the lookup key when the configured amount changes', async () => {
    await createStripeProduct()
    plans[0]!.pricing[0]!.price = 2900
    writes.prices = []

    const result = await createStripeProduct()
    plans[0]!.pricing[0]!.price = 1900 // restore for other tests

    expect(result.value.actions.map(a => a.verb)).toEqual(['reuse', 'replace'])
    expect(writes.prices.length).toBe(1)
    expect(writes.prices[0].transfer_lookup_key).toBe(true)
    expect(writes.prices[0].unit_amount).toBe(2900)
    // Exactly one active price still carries the key, and the superseded price survives.
    expect(account.prices.filter(p => p.lookup_key === 'hobby_monthly').length).toBe(1)
    expect(account.prices.filter(p => p.active).length).toBe(2)
  })

  it('reuses the product when only a new plan price is added', async () => {
    await createStripeProduct()
    plans[0]!.pricing.push({ key: 'hobby_yearly', price: 19000, interval: 'year' as const, currency: 'usd' })
    writes.products = []

    const result = await createStripeProduct()
    plans[0]!.pricing.pop()

    expect(result.value.actions.map(a => `${a.kind}:${a.verb}`))
      .toEqual(['product:reuse', 'price:reuse', 'price:create'])
    expect(writes.products).toEqual([])
  })
})

describe('dry run', () => {
  it('writes nothing to a clean account but still reports the plan', async () => {
    const result = await createStripeProduct({ dryRun: true })
    expect(result.value.dryRun).toBe(true)
    expect(result.value.actions.map(a => a.verb)).toEqual(['create', 'create'])
    expect(writes.products).toEqual([])
    expect(writes.prices).toEqual([])
    expect(account.products).toEqual([])
    expect(account.prices).toEqual([])
  })

  it('writes nothing when a change is pending', async () => {
    await createStripeProduct()
    plans[0]!.pricing[0]!.price = 2900
    writes.prices = []

    const result = await createStripeProduct({ dryRun: true })
    plans[0]!.pricing[0]!.price = 1900

    expect(result.value.actions.map(a => a.verb)).toEqual(['reuse', 'replace'])
    expect(writes.prices).toEqual([])
  })
})

describe('formatSetupReport', () => {
  it('says so when there is nothing declared', () => {
    expect(formatSetupReport({ dryRun: true, actions: [] })[0]).toContain('nothing to provision')
  })

  it('renders one line per action', () => {
    const lines = formatSetupReport({
      dryRun: false,
      actions: [
        { kind: 'product', verb: 'reuse', target: 'Test Hobby', detail: 'prod_1' },
        { kind: 'price', verb: 'replace', target: 'hobby_monthly' },
      ],
    })
    expect(lines[0]).toContain('already exists')
    expect(lines[1]).toContain('moves lookup key')
  })
})
