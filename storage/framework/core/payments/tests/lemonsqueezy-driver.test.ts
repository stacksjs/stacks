import type { LemonSqueezyConfig } from '../src/driver'
import { describe, expect, it } from 'bun:test'
import {
  lemonSqueezyConfig,
  LemonSqueezyDriver,
  lemonSqueezySignature,
  PaymentProviderError,
  PaymentUnsupportedError,
  registerPaymentDriver,
  summarizeLemonSqueezySubscription,
  WebhookNotConfiguredError,
  WebhookSignatureError,
} from '../src/driver'

/**
 * The Lemon Squeezy driver against a recording `fetch`: every request is
 * asserted as it would leave the process, and the answers are JSON:API
 * documents shaped as Lemon Squeezy's API reference gives them. Webhook
 * signatures are HMAC-SHA256 of the raw body under the signing secret, hex,
 * as its signing guide describes.
 */

interface Sent { method: string, url: URL, headers: Record<string, string>, body: any }
type Reply = { status?: number, body?: unknown } | ((sent: Sent) => { status?: number, body?: unknown })

const SECRET = 'lemonsqueezy-webhook-test-secret'

function lemon(routes: Record<string, Reply> = {}, config: Partial<LemonSqueezyConfig> = {}) {
  const sent: Sent[] = []
  const fetch = (async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const entry: Sent = {
      method: init.method ?? 'GET',
      url,
      headers: init.headers as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    sent.push(entry)
    const route = routes[`${entry.method} ${url.pathname}`]
    if (!route)
      return Response.json({ errors: [{ status: '404', title: 'Not Found', detail: `no route for ${entry.method} ${url.pathname}` }] }, { status: 404 })
    const reply = typeof route === 'function' ? route(entry) : route
    return Response.json(reply.body ?? {}, { status: reply.status ?? 200 })
  }) as typeof globalThis.fetch

  const driver = new LemonSqueezyDriver({
    apiKey: 'ls-test-api-key',
    storeId: '1234',
    webhookSecret: SECRET,
    appUrl: 'https://app.test',
    ...config,
  }, { fetch })
  return { driver, sent }
}

const payer = { id: 7, email: 'ada@example.com', name: 'Ada Lovelace' }

const subscription = (attributes: Record<string, unknown>) => ({
  type: 'subscriptions',
  id: '501',
  attributes: { variant_id: 77, variant_name: 'Pro', product_name: 'Stacks Pro', renews_at: '2026-11-06T00:00:00.000000Z', ends_at: null, cancelled: false, ...attributes },
})

describe('LemonSqueezyDriver', () => {
  it('needs an API key and a store', () => {
    expect(() => new LemonSqueezyDriver({ apiKey: '', storeId: '1' })).toThrow('LEMONSQUEEZY_API_KEY')
    expect(() => new LemonSqueezyDriver({ apiKey: 'k', storeId: '' })).toThrow('LEMONSQUEEZY_STORE_ID')
  })

  it('talks JSON:API with the bearer key', async () => {
    const { driver, sent } = lemon({ 'GET /v1/customers': { body: { data: [{ type: 'customers', id: '9', attributes: { email: 'ada@example.com', name: 'Ada' } }] } } })
    await driver.customer(payer)

    expect(sent[0]!.url.origin).toBe('https://api.lemonsqueezy.com')
    expect(sent[0]!.headers).toMatchObject({ Authorization: 'Bearer ls-test-api-key', Accept: 'application/vnd.api+json' })
  })

  it('finds a customer by email in the store, and creates one when there is none', async () => {
    const found = lemon({ 'GET /v1/customers': { body: { data: [{ type: 'customers', id: '9', attributes: { email: 'ada@example.com', name: 'Ada' } }] } } })
    expect(await found.driver.customer(payer)).toEqual({ id: '9', email: 'ada@example.com', name: 'Ada' })
    expect(Object.fromEntries(found.sent[0]!.url.searchParams)).toEqual({ 'filter[store_id]': '1234', 'filter[email]': 'ada@example.com' })

    const created = lemon({
      'GET /v1/customers': { body: { data: [] } },
      'POST /v1/customers': { status: 201, body: { data: { type: 'customers', id: '10', attributes: { email: 'ada@example.com', name: 'Ada Lovelace' } } } },
    })
    expect(await created.driver.customer(payer)).toEqual({ id: '10', email: 'ada@example.com', name: 'Ada Lovelace' })
    expect(created.sent[1]!.body).toEqual({
      data: {
        type: 'customers',
        attributes: { email: 'ada@example.com', name: 'Ada Lovelace' },
        relationships: { store: { data: { type: 'stores', id: '1234' } } },
      },
    })
    await expect(created.driver.customer({ id: 1 })).rejects.toThrow('identified by email')
  })

  it('says what it cannot do, rather than reaching for an API that is not there', async () => {
    const { driver } = lemon()
    for (const call of [
      () => driver.charge(),
      () => driver.createPayment(),
      () => driver.paymentMethods(),
      () => driver.removePaymentMethod(),
      () => driver.subscribe(),
    ])
      await expect(call()).rejects.toBeInstanceOf(PaymentUnsupportedError)
    expect([...driver.capabilities].sort()).toEqual(['checkout', 'customers', 'refund', 'subscriptions', 'webhooks'])
  })

  describe('checkout', () => {
    const created = { status: 201, body: { data: { type: 'checkouts', id: 'chk-uuid', attributes: { url: 'https://store.lemonsqueezy.com/checkout/custom/chk-uuid?signature=x', expires_at: null } } } }

    it('sells a variant, prefilled with the payer and carrying the reference back in custom data', async () => {
      const { driver, sent } = lemon({ 'POST /v1/checkouts': created })
      const session = await driver.checkout(payer, {
        mode: 'subscription',
        lines: [{ price: '77', quantity: 1 }],
        successUrl: 'https://app.test/billing/done',
        reference: 'plan-pro',
        metadata: { team: '3' },
        allowPromotionCodes: true,
      })

      expect(session).toMatchObject({ id: 'chk-uuid', url: 'https://store.lemonsqueezy.com/checkout/custom/chk-uuid?signature=x', expiresAt: null })
      expect(sent[0]!.body).toEqual({
        data: {
          type: 'checkouts',
          attributes: {
            product_options: { redirect_url: 'https://app.test/billing/done' },
            checkout_options: { discount: true },
            checkout_data: {
              custom: { team: '3', reference: 'plan-pro', stacks_user_id: '7' },
              email: 'ada@example.com',
              name: 'Ada Lovelace',
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: '1234' } },
            variant: { data: { type: 'variants', id: '77' } },
          },
        },
      })
    })

    it('asks for a quantity of a variant, and hides the discount field unless promotion codes are allowed', async () => {
      const { driver, sent } = lemon({ 'POST /v1/checkouts': created }, { testMode: true })
      await driver.checkout(payer, { mode: 'payment', lines: [{ price: '77', quantity: 3 }], successUrl: 'https://app.test/done' })

      expect(sent[0]!.body.data.attributes).toMatchObject({
        checkout_options: { discount: false },
        checkout_data: { variant_quantities: [{ variant_id: 77, quantity: 3 }] },
        test_mode: true,
      })
    })

    it('sells a line priced here as the custom-price variant, in the store\'s currency', async () => {
      const { driver, sent } = lemon({
        'GET /v1/stores/1234': { body: { data: { type: 'stores', id: '1234', attributes: { currency: 'USD' } } } },
        'POST /v1/checkouts': created,
      }, { customPriceVariantId: '88' })

      await driver.checkout(payer, { mode: 'payment', currency: 'usd', lines: [{ name: 'Order #12', unitAmount: 1250, quantity: 2 }], successUrl: 'https://app.test/done' })

      expect(sent[1]!.body.data.attributes).toMatchObject({ custom_price: 2500, product_options: { name: 'Order #12 x 2', redirect_url: 'https://app.test/done' } })
      expect(sent[1]!.body.data.relationships.variant).toEqual({ data: { type: 'variants', id: '88' } })
      expect(sent[1]!.body.data.attributes.checkout_data.variant_quantities).toBeUndefined()

      await expect(driver.checkout(payer, { mode: 'payment', currency: 'eur', lines: [{ name: 'x', unitAmount: 100, quantity: 1 }], successUrl: 'https://app.test/done' }))
        .rejects.toThrow('sells in USD')
    })

    it('refuses what a Lemon Squeezy checkout cannot be', async () => {
      const { driver } = lemon({ 'POST /v1/checkouts': created })
      const base = { mode: 'payment' as const, lines: [{ price: '77', quantity: 1 }], successUrl: 'https://app.test/done' }

      await expect(driver.checkout(payer, { ...base, mode: 'setup' })).rejects.toBeInstanceOf(PaymentUnsupportedError)
      await expect(driver.checkout(payer, { ...base, lines: [{ price: '1', quantity: 1 }, { price: '2', quantity: 1 }] })).rejects.toThrow('a checkout with 2 lines')
      await expect(driver.checkout(payer, { ...base, cancelUrl: 'https://app.test/cart' })).rejects.toThrow('cancelUrl')
      await expect(driver.checkout(payer, { ...base, mode: 'subscription', trialDays: 7 })).rejects.toThrow('trial')
      await expect(driver.checkout(payer, { ...base, lines: [{ name: 'x', unitAmount: 100, quantity: 1 }] })).rejects.toThrow('LEMONSQUEEZY_VARIANT_ID')
      await expect(driver.checkout(payer, { ...base, successUrl: 'https://evil.example/' })).rejects.toThrow('not on the application\'s origin')
    })
  })

  describe('refund', () => {
    const order = (attributes: Record<string, unknown>) => ({ data: { type: 'orders', id: '3001', attributes: { status: 'paid', currency: 'USD', total: 2500, ...attributes } } })

    it('refunds a whole order, without restating the amount', async () => {
      const { driver, sent } = lemon({ 'POST /v1/orders/3001/refund': { body: order({ status: 'refunded', refunded: true, refunded_amount: 2500 }) } })
      const refund = await driver.refund('3001')

      expect(sent[0]!.body).toEqual({ data: { type: 'orders', id: '3001' } })
      expect(refund).toMatchObject({ id: '3001:refunded:2500', paymentId: '3001', status: 'succeeded', amount: null })
    })

    it('refunds part of an order in its own currency, and refuses another', async () => {
      const { driver, sent } = lemon({
        'GET /v1/orders/3001': { body: order({}) },
        'POST /v1/orders/3001/refund': { body: order({ status: 'partial_refund', refunded_amount: 1000 }) },
      })
      const refund = await driver.refund('3001', { amount: { amount: 1000, currency: 'usd' } })

      expect(sent[1]!.body).toEqual({ data: { type: 'orders', id: '3001', attributes: { amount: 1000 } } })
      expect(refund).toMatchObject({ status: 'succeeded', amount: { amount: 1000, currency: 'usd' } })
      await expect(driver.refund('3001', { amount: { amount: 1000, currency: 'eur' } })).rejects.toThrow('the order is in USD')
      await expect(driver.refund('3001', { amount: { amount: 10.5, currency: 'usd' } })).rejects.toThrow('whole number of minor units')
    })

    it('carries Lemon Squeezy\'s error detail', async () => {
      const { driver } = lemon({ 'POST /v1/orders/3001/refund': { status: 422, body: { errors: [{ status: '422', title: 'Unprocessable Entity', detail: 'The order has already been fully refunded.' }] } } })
      const error = await driver.refund('3001').catch(e => e)
      expect(error).toBeInstanceOf(PaymentProviderError)
      expect(error.message).toBe('lemonsqueezy rejected the request (422): The order has already been fully refunded.')
    })
  })

  describe('subscriptions', () => {
    it('lists the payer\'s, every page, by email in the store', async () => {
      const { driver, sent } = lemon({
        'GET /v1/subscriptions': (request) => {
          const page = Number(request.url.searchParams.get('page[number]'))
          return { body: { meta: { page: { currentPage: page, lastPage: 2 } }, data: [subscription({ status: page === 1 ? 'active' : 'on_trial' })] } }
        },
      })
      const listed = await driver.subscriptions(payer)

      expect(listed.map(s => s.status)).toEqual(['active', 'trialing'])
      expect(Object.fromEntries(sent[0]!.url.searchParams)).toEqual({ 'filter[store_id]': '1234', 'filter[user_email]': 'ada@example.com', 'page[number]': '1', 'page[size]': '100' })
      expect(sent).toHaveLength(2)
    })

    it('reports a cancelled subscription as active until it ends, and an expired one as canceled', () => {
      expect(summarizeLemonSqueezySubscription(subscription({ status: 'active' }) as any)).toMatchObject({
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date('2026-11-06T00:00:00.000Z'),
        price: { id: '77', name: 'Pro', amount: null, interval: null },
      })
      expect(summarizeLemonSqueezySubscription(subscription({ status: 'cancelled', cancelled: true, ends_at: '2026-11-06T00:00:00.000000Z' }) as any))
        .toMatchObject({ status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: new Date('2026-11-06T00:00:00.000Z') })
      expect(summarizeLemonSqueezySubscription(subscription({ status: 'expired', ends_at: '2026-10-01T00:00:00.000000Z' }) as any))
        .toMatchObject({ status: 'canceled', cancelAtPeriodEnd: false })
      expect(summarizeLemonSqueezySubscription(subscription({ status: 'something_new' }) as any).status).toBe('unknown')
    })

    it('cancels at the end of the period, and refuses an immediate cancellation', async () => {
      const { driver, sent } = lemon({ 'DELETE /v1/subscriptions/501': { body: { data: subscription({ status: 'cancelled', cancelled: true, ends_at: '2026-11-06T00:00:00.000000Z' }) } } })

      expect(await driver.cancelSubscription('501', { atPeriodEnd: true })).toMatchObject({ id: '501', cancelAtPeriodEnd: true })
      expect(sent[0]!.method).toBe('DELETE')
      await expect(driver.cancelSubscription('501')).rejects.toThrow('cancels at the end of the billing period')
    })
  })

  describe('webhooks', () => {
    function deliver(driver: LemonSqueezyDriver, payload: unknown, signature?: string) {
      const body = JSON.stringify(payload)
      return driver.verifyWebhook({ payload: body, headers: { 'X-Event-Name': 'x', 'X-Signature': signature ?? lemonSqueezySignature(body, SECRET) } })
    }

    const orderEvent = (name: string, attributes: Record<string, unknown>, custom: Record<string, unknown> | null = { reference: 'cart-9' }) => ({
      meta: { event_name: name, custom_data: custom, test_mode: true },
      data: { type: 'orders', id: '3001', attributes: { currency: 'USD', total: 2500, ...attributes } },
    })

    it('translates a paid and a failed order', async () => {
      const { driver } = lemon()
      const [paid] = await deliver(driver, orderEvent('order_created', { status: 'paid' }))
      expect(paid).toMatchObject({ provider: 'lemonsqueezy', type: 'payment.succeeded', providerType: 'order_created', reference: '3001', merchantReference: 'cart-9', amount: { amount: 2500, currency: 'usd' } })
      expect(paid!.id).toMatch(/^order_created:[\da-f]{32}$/)

      const [failed] = await deliver(driver, orderEvent('order_created', { status: 'failed' }, null))
      expect(failed).toMatchObject({ type: 'payment.failed', merchantReference: null })
      const [pending] = await deliver(driver, orderEvent('order_created', { status: 'pending' }))
      expect(pending!.type).toBe('unknown')
    })

    it('states a refund as the order\'s refunded total, since that is all Lemon Squeezy sends', async () => {
      const { driver } = lemon()
      const [refund] = await deliver(driver, orderEvent('order_refunded', { status: 'partial_refund', refunded_amount: 1000 }))
      expect(refund).toMatchObject({ type: 'refund.succeeded', reference: '3001', amount: null, refundedTotal: { amount: 1000, currency: 'usd' } })
    })

    it('recognises a retry by its bytes, and tells two deliveries apart', async () => {
      const { driver } = lemon()
      const first = await deliver(driver, orderEvent('order_refunded', { refunded_amount: 1000 }))
      const retry = await deliver(driver, orderEvent('order_refunded', { refunded_amount: 1000 }))
      const second = await deliver(driver, orderEvent('order_refunded', { refunded_amount: 2500 }))
      expect(retry[0]!.id).toBe(first[0]!.id)
      expect(second[0]!.id).not.toBe(first[0]!.id)
    })

    it('translates the subscription lifecycle, ending a subscription only when it expires', async () => {
      const { driver } = lemon()
      const type = async (name: string) => (await deliver(driver, { meta: { event_name: name }, data: subscription({ status: 'active', total: 900, currency: 'USD' }) }))[0]!.type
      expect(await type('subscription_created')).toBe('subscription.created')
      expect(await type('subscription_cancelled')).toBe('subscription.updated')
      expect(await type('subscription_expired')).toBe('subscription.canceled')
      expect(await type('subscription_payment_success')).toBe('invoice.paid')
      expect(await type('subscription_payment_failed')).toBe('invoice.payment_failed')
      expect(await type('license_key_created')).toBe('unknown')
    })

    it('refuses a delivery it cannot verify', async () => {
      const { driver } = lemon()
      await expect(deliver(driver, orderEvent('order_created', { status: 'paid' }), lemonSqueezySignature('{}', SECRET))).rejects.toBeInstanceOf(WebhookSignatureError)
      await expect(deliver(driver, orderEvent('order_created', { status: 'paid' }), 'not-hex')).rejects.toThrow('signed with another secret')
      await expect(driver.verifyWebhook({ payload: '{}', headers: {} })).rejects.toThrow('no X-Signature header')
      await expect(lemon({}, { webhookSecret: undefined }).driver.verifyWebhook({ payload: '{}', headers: {} })).rejects.toBeInstanceOf(WebhookNotConfiguredError)
    })

    it('acknowledges with a 200, which is what stops Lemon Squeezy retrying', () => {
      expect(lemon().driver.acknowledgeWebhook().status).toBe(200)
    })
  })
})

describe('lemonSqueezyConfig', () => {
  it('reads config/payment.ts, then the LEMONSQUEEZY_* environment', () => {
    expect(lemonSqueezyConfig({}, { LEMONSQUEEZY_API_KEY: 'k', LEMONSQUEEZY_STORE_ID: '5', LEMONSQUEEZY_WEBHOOK_SECRET: 's', LEMONSQUEEZY_VARIANT_ID: '88', LEMONSQUEEZY_TEST_MODE: 'true' }))
      .toEqual({ apiKey: 'k', storeId: '5', webhookSecret: 's', customPriceVariantId: '88', testMode: true })
    expect(lemonSqueezyConfig({ storeId: '9', testMode: false }, { LEMONSQUEEZY_STORE_ID: '5', LEMONSQUEEZY_TEST_MODE: 'true' }))
      .toMatchObject({ storeId: '9', testMode: false, webhookSecret: undefined })
  })

  it('is a built-in name that cannot be replaced', () => {
    expect(() => registerPaymentDriver('lemonsqueezy', () => lemon().driver)).toThrow('built-in')
  })
})
