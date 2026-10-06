import type { PaddleConfig } from '../src/driver'
import { describe, expect, it } from 'bun:test'
import {
  PADDLE_SUCCESS_URL_KEY,
  PaddleDriver,
  paddleConfig,
  paddleRefundStatus,
  paddleSignature,
  parsePaddleSignature,
  PaymentProviderError,
  PaymentUnsupportedError,
  registerPaymentDriver,
  summarizePaddleSubscription,
  WebhookNotConfiguredError,
  WebhookSignatureError,
} from '../src/driver'

/**
 * The Paddle Billing driver against a recording `fetch`: every request is
 * asserted as it would leave the process, and Paddle's answers are scripted
 * from its API reference. Webhook signatures follow Paddle's reference
 * implementation (HMAC-SHA256 of `<ts>:<raw body>` under the secret, hex).
 */

interface Sent { method: string, url: URL, headers: Record<string, string>, body: any }
type Reply = { status?: number, body?: unknown } | ((sent: Sent) => { status?: number, body?: unknown })

// Not a real secret's shape on purpose: push protection rejects one, and the
// HMAC does not care what the key looks like.
const SECRET = 'paddle-webhook-test-secret'
const NOW = 1_790_000_000

function paddle(routes: Record<string, Reply> = {}, config: Partial<PaddleConfig> = {}) {
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
      return Response.json({ error: { code: 'not_found', detail: `no route for ${entry.method} ${url.pathname}` } }, { status: 404 })
    const reply = typeof route === 'function' ? route(entry) : route
    if (reply.status === 204)
      return new Response(null, { status: 204 })
    return Response.json(reply.body ?? {}, { status: reply.status ?? 200 })
  }) as typeof globalThis.fetch

  const driver = new PaddleDriver({
    apiKey: 'pdl_sdbx_apikey_test',
    environment: 'sandbox',
    webhookSecret: SECRET,
    appUrl: 'https://app.test',
    ...config,
  }, { fetch, now: () => NOW * 1000 })
  return { driver, sent }
}

const payer = { id: 7, email: 'payer@example.com', name: 'Pat Payer' }
const CUSTOMER = { id: 'ctm_01h8441jn5pcwrfhwh78jqt8hk', email: 'payer@example.com', name: 'Pat Payer' }
const existingCustomer = { 'GET /customers': { body: { data: [CUSTOMER] } } }

describe('Paddle driver - setup', () => {
  it('talks to the environment its key belongs to, with Paddle-Version 1', async () => {
    const { driver, sent } = paddle(existingCustomer)
    expect(driver.baseUrl).toBe('https://sandbox-api.paddle.com')
    await driver.customer(payer)
    expect(sent[0]!.url.origin).toBe('https://sandbox-api.paddle.com')
    expect(sent[0]!.headers.Authorization).toStartWith('Bearer pdl_sdbx_apikey_')
    expect(sent[0]!.headers['Paddle-Version']).toBe('1')

    const live = new PaddleDriver({ apiKey: 'pdl_live_apikey_test', environment: 'live' })
    expect(live.baseUrl).toBe('https://api.paddle.com')
  })

  it('refuses a key from the other environment, or none at all', () => {
    expect(() => new PaddleDriver({ apiKey: 'pdl_live_apikey_x', environment: 'sandbox' })).toThrow('a live key')
    expect(() => new PaddleDriver({ apiKey: '', environment: 'sandbox' })).toThrow('PADDLE_API_KEY')
  })

  it('reads its settings from config, then the PADDLE_* environment', () => {
    expect(paddleConfig({}, { PADDLE_API_KEY: 'k', PADDLE_ENVIRONMENT: 'live', PADDLE_WEBHOOK_SECRET: 's', PADDLE_CLIENT_TOKEN: 't', PADDLE_TAX_CATEGORY: 'saas' }))
      .toEqual({ apiKey: 'k', environment: 'live', webhookSecret: 's', clientToken: 't', taxCategory: 'saas', webhookTolerance: undefined })
    expect(paddleConfig({ apiKey: 'from-config' }, {})).toMatchObject({ apiKey: 'from-config', environment: 'sandbox' })
  })

  it('is a built-in name a registered driver cannot take', () => {
    expect(() => registerPaymentDriver('paddle', () => paddle().driver)).toThrow('built-in')
  })
})

describe('Paddle driver - customers', () => {
  it('finds the customer by email', async () => {
    const { driver, sent } = paddle(existingCustomer)
    expect(await driver.customer(payer)).toEqual({ id: CUSTOMER.id, email: CUSTOMER.email, name: CUSTOMER.name })
    expect(sent[0]!.url.searchParams.get('email')).toBe('payer@example.com')
  })

  it('creates one when there is none, tagged with the user', async () => {
    const { driver, sent } = paddle({
      'GET /customers': { body: { data: [] } },
      'POST /customers': { status: 201, body: { data: CUSTOMER } },
    })
    expect((await driver.customer(payer)).id).toBe(CUSTOMER.id)
    expect(sent[1]!.body).toEqual({ email: 'payer@example.com', name: 'Pat Payer', custom_data: { stacks_user_id: '7' } })
  })

  it('takes the existing customer Paddle names when another request created it first', async () => {
    const { driver } = paddle({
      'GET /customers': { body: { data: [] } },
      'POST /customers': { status: 409, body: { error: { type: 'request_error', code: 'customer_already_exists', detail: `customer email conflicts with customer of id ${CUSTOMER.id}` } } },
      [`GET /customers/${CUSTOMER.id}`]: { body: { data: CUSTOMER } },
    })
    expect((await driver.customer(payer)).id).toBe(CUSTOMER.id)
  })

  it('needs an email, since that is how Paddle knows a customer', async () => {
    await expect(paddle().driver.customer({ id: 7 })).rejects.toThrow('identified by email')
  })
})

describe('Paddle driver - payments', () => {
  const transaction = { id: 'txn_01hv8m0mnx3sj85e7gxc6kga03', status: 'ready', checkout: { url: 'https://app.test/payments/checkout?_ptxn=txn_01hv8m0mnx3sj85e7gxc6kga03' } }

  it('starts a payment as a transaction priced here, tax included, for Paddle.js to complete', async () => {
    const { driver, sent } = paddle({ ...existingCustomer, 'POST /transactions': { status: 201, body: { data: transaction } } })
    const result = await driver.createPayment(payer, { amount: 2999, currency: 'eur' }, { reference: 'order-1', description: 'Annual pass', returnUrl: 'https://app.test/thanks' })

    expect(sent[1]!.body).toEqual({
      items: [{
        quantity: 1,
        price: {
          description: 'Annual pass',
          name: 'Annual pass',
          tax_mode: 'internal',
          unit_price: { amount: '2999', currency_code: 'EUR' },
          product: { name: 'Annual pass', tax_category: 'standard' },
        },
      }],
      customer_id: CUSTOMER.id,
      currency_code: 'EUR',
      collection_mode: 'automatic',
      custom_data: { reference: 'order-1' },
    })
    expect(result).toMatchObject({
      id: transaction.id,
      status: 'requires_payment_method',
      amount: { amount: 2999, currency: 'eur' },
      clientConfirmation: { provider: 'paddle', transactionId: transaction.id, successUrl: 'https://app.test/thanks' },
    })
  })

  it('refuses a success page off the application\'s origin', async () => {
    await expect(paddle(existingCustomer).driver.createPayment(payer, { amount: 100, currency: 'eur' }, { returnUrl: 'https://evil.example/' }))
      .rejects.toThrow('not on the application\'s origin')
  })

  it('cannot charge a stored method server side, or subscribe outside checkout', async () => {
    const { driver } = paddle()
    const charge = await driver.charge().catch(e => e)
    expect(charge).toBeInstanceOf(PaymentUnsupportedError)
    expect(charge).toMatchObject({ driver: 'paddle', operation: 'charge' })
    await expect(driver.subscribe()).rejects.toThrow('starts at checkout')
    expect(driver.capabilities.has('charge')).toBe(false)
    expect(driver.capabilities.has('subscriptions')).toBe(true)
  })

  it('says what Paddle rejected, with its code', async () => {
    const { driver } = paddle({ ...existingCustomer, 'POST /transactions': { status: 400, body: { error: { code: 'bad_request', detail: 'Invalid request.' } } } })
    const error = await driver.createPayment(payer, { amount: 100, currency: 'eur' }).catch(e => e)
    expect(error).toBeInstanceOf(PaymentProviderError)
    expect(error).toMatchObject({ driver: 'paddle', status: 400, code: 'bad_request' })
  })
})

describe('Paddle driver - checkout', () => {
  const created = (url: string | null) => ({ status: 201, body: { data: { id: 'txn_01hv8m0mnx3sj85e7gxc6kga03', status: 'ready', checkout: { url } } } })

  it('opens a transaction on your payment link, carrying the success page for the checkout page', async () => {
    const link = 'https://app.test/payments/checkout?_ptxn=txn_01hv8m0mnx3sj85e7gxc6kga03'
    const { driver, sent } = paddle({ ...existingCustomer, 'POST /transactions': created(link) })
    const session = await driver.checkout(payer, {
      mode: 'payment',
      currency: 'usd',
      lines: [{ price: 'pri_01gsz8x8sawmvhz1pv30nge1ke', quantity: 2 }, { name: 'Setup', unitAmount: 900, quantity: 1 }],
      successUrl: 'https://app.test/done',
      reference: 'order-3',
      metadata: { plan: 'pro' },
      automaticTax: true,
    })

    expect(session).toMatchObject({ id: 'txn_01hv8m0mnx3sj85e7gxc6kga03', url: link })
    expect(sent[1]!.body).toMatchObject({
      items: [
        { price_id: 'pri_01gsz8x8sawmvhz1pv30nge1ke', quantity: 2 },
        { quantity: 1, price: { name: 'Setup', tax_mode: 'internal', unit_price: { amount: '900', currency_code: 'USD' } } },
      ],
      customer_id: CUSTOMER.id,
      currency_code: 'USD',
      custom_data: { plan: 'pro', reference: 'order-3', [PADDLE_SUCCESS_URL_KEY]: 'https://app.test/done' },
      checkout: { url: null },
    })
  })

  it('says so when the account has no default payment link', async () => {
    const { driver } = paddle({ ...existingCustomer, 'POST /transactions': created(null) })
    await expect(driver.checkout(payer, { mode: 'payment', lines: [{ price: 'pri_1', quantity: 1 }], successUrl: 'https://app.test/done' }))
      .rejects.toThrow('default payment link')
  })

  it('refuses what a Paddle checkout cannot do, naming it', async () => {
    const { driver } = paddle(existingCustomer)
    const base = { lines: [{ price: 'pri_1', quantity: 1 }], successUrl: 'https://app.test/done' }
    await expect(driver.checkout(payer, { ...base, mode: 'setup' })).rejects.toThrow('setup checkout')
    await expect(driver.checkout(payer, { ...base, mode: 'payment', cancelUrl: 'https://app.test/back' })).rejects.toThrow('separate cancelUrl')
    await expect(driver.checkout(payer, { ...base, mode: 'payment', allowPromotionCodes: true })).rejects.toThrow('promotion codes')
    await expect(driver.checkout(payer, { ...base, mode: 'subscription', trialDays: 14 })).rejects.toThrow('trial')
    await expect(driver.checkout(payer, { mode: 'subscription', currency: 'usd', lines: [{ name: 'Pro', unitAmount: 900, quantity: 1 }], successUrl: 'https://app.test/done' }))
      .rejects.toThrow('catalog prices')
    await expect(driver.checkout(payer, { ...base, mode: 'payment', successUrl: 'https://evil.example/done' })).rejects.toThrow('not on the application\'s origin')
  })

  it('gives the checkout page the success page a transaction was created with', async () => {
    const id = 'txn_01hv8m0mnx3sj85e7gxc6kga03'
    const { driver } = paddle({ [`GET /transactions/${id}`]: { body: { data: { id, status: 'ready', custom_data: { [PADDLE_SUCCESS_URL_KEY]: 'https://app.test/done' } } } } })
    expect(await driver.checkoutSuccessUrl(id)).toBe('https://app.test/done')
  })

  it('gives it nothing for a transaction without one, and refuses a forged one', async () => {
    const id = 'txn_01hv8m0mnx3sj85e7gxc6kga03'
    const none = paddle({ [`GET /transactions/${id}`]: { body: { data: { id, status: 'ready', custom_data: null } } } })
    expect(await none.driver.checkoutSuccessUrl(id)).toBeNull()

    const forged = paddle({ [`GET /transactions/${id}`]: { body: { data: { id, status: 'ready', custom_data: { [PADDLE_SUCCESS_URL_KEY]: 'https://evil.example/' } } } } })
    await expect(forged.driver.checkoutSuccessUrl(id)).rejects.toThrow('not on the application\'s origin')

    await expect(none.driver.checkoutSuccessUrl('../customers')).rejects.toThrow('Not a Paddle transaction id')
  })
})

describe('Paddle driver - refunds', () => {
  const id = 'txn_01hv8m0mnx3sj85e7gxc6kga03'
  const transaction = {
    id,
    status: 'completed',
    currency_code: 'USD',
    details: {
      totals: { grand_total: '1500', currency_code: 'USD' },
      line_items: [
        { id: 'txnitm_01hv8m0n6xqk32jsq5q6pv7mpk', totals: { total: '1000' } },
        { id: 'txnitm_01hv8m0n6xqk32jsq5q6pv7mpm', totals: { total: '500' } },
      ],
    },
  }
  const adjustment = (status: string, total: string) => ({ status: 201, body: { data: { id: 'adj_01hvgf2s84dr6reszzg29zbvcm', action: 'refund', transaction_id: id, status, totals: { total, currency_code: 'USD' } } } })

  it('refunds a whole transaction as a full adjustment, which Paddle reviews', async () => {
    const { driver, sent } = paddle({ 'POST /adjustments': adjustment('pending_approval', '1500') })
    const result = await driver.refund(id)
    expect(sent[0]!.body).toEqual({ action: 'refund', transaction_id: id, reason: 'requested_by_customer', type: 'full' })
    expect(result).toMatchObject({ id: 'adj_01hvgf2s84dr6reszzg29zbvcm', paymentId: id, status: 'pending', amount: { amount: 1500, currency: 'usd' } })
  })

  it('takes a partial amount from the line items in order, tax included', async () => {
    const { driver, sent } = paddle({ [`GET /transactions/${id}`]: { body: { data: transaction } }, 'POST /adjustments': adjustment('pending_approval', '1200') })
    await driver.refund(id, { amount: { amount: 1200, currency: 'usd' }, reason: 'duplicate' })
    expect(sent[1]!.body).toEqual({
      action: 'refund',
      transaction_id: id,
      reason: 'duplicate',
      type: 'partial',
      tax_mode: 'internal',
      items: [
        { item_id: 'txnitm_01hv8m0n6xqk32jsq5q6pv7mpk', type: 'full' },
        { item_id: 'txnitm_01hv8m0n6xqk32jsq5q6pv7mpm', type: 'partial', amount: '200' },
      ],
    })
  })

  it('refuses more than the transaction took, or another currency', async () => {
    const { driver } = paddle({ [`GET /transactions/${id}`]: { body: { data: transaction } } })
    await expect(driver.refund(id, { amount: { amount: 1600, currency: 'usd' } })).rejects.toThrow('more than the transaction')
    await expect(driver.refund(id, { amount: { amount: 100, currency: 'eur' } })).rejects.toThrow('in EUR, but the transaction is in USD')
  })

  it('reads an adjustment status in our terms', () => {
    expect(paddleRefundStatus('pending_approval')).toBe('pending')
    expect(paddleRefundStatus('approved')).toBe('succeeded')
    expect(paddleRefundStatus('rejected')).toBe('failed')
    expect(paddleRefundStatus('reversed')).toBe('canceled')
  })
})

describe('Paddle driver - payment methods and subscriptions', () => {
  const subscription = {
    id: 'sub_01hv8y5ehszzq0yv20ttx3166y',
    status: 'active',
    current_billing_period: { starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' },
    scheduled_change: null,
    items: [{ quantity: 1, price: { id: 'pri_01gsz8x8sawmvhz1pv30nge1ke', name: 'Monthly', description: 'Pro monthly', unit_price: { amount: '2900', currency_code: 'USD' }, billing_cycle: { interval: 'month', frequency: 1 } } }],
  }

  it('lists saved payment methods; Paddle keeps no default', async () => {
    const { driver, sent } = paddle({
      ...existingCustomer,
      [`GET /customers/${CUSTOMER.id}/payment-methods`]: { body: { data: [{ id: 'paymtd_01hkm9xwqpbbpr1ksmvg3sx3v1', type: 'card', card: { type: 'visa', last4: '4242', expiry_month: 4, expiry_year: 2030 } }] } },
      [`DELETE /customers/${CUSTOMER.id}/payment-methods/paymtd_01hkm9xwqpbbpr1ksmvg3sx3v1`]: { status: 204 },
    })
    expect(await driver.paymentMethods(payer)).toEqual([{ id: 'paymtd_01hkm9xwqpbbpr1ksmvg3sx3v1', type: 'card', brand: 'visa', last4: '4242', expMonth: 4, expYear: 2030, isDefault: false, raw: expect.anything() }])
    await driver.removePaymentMethod(payer, 'paymtd_01hkm9xwqpbbpr1ksmvg3sx3v1')
    expect(sent.at(-1)!.method).toBe('DELETE')
  })

  it('cancels now or at the end of the period', async () => {
    const { driver, sent } = paddle({
      [`POST /subscriptions/${subscription.id}/cancel`]: sentRequest => ({
        body: { data: sentRequest.body.effective_from === 'immediately'
          ? { ...subscription, status: 'canceled', current_billing_period: null }
          : { ...subscription, scheduled_change: { action: 'cancel', effective_at: '2026-11-01T00:00:00Z' } } },
      }),
    })
    expect(await driver.cancelSubscription(subscription.id)).toMatchObject({ status: 'canceled', cancelAtPeriodEnd: false })
    expect(await driver.cancelSubscription(subscription.id, { atPeriodEnd: true })).toMatchObject({ status: 'active', cancelAtPeriodEnd: true })
    expect(sent.map(entry => entry.body.effective_from)).toEqual(['immediately', 'next_billing_period'])
  })

  it('lists the customer\'s subscriptions in our terms', async () => {
    const { driver, sent } = paddle({ ...existingCustomer, 'GET /subscriptions': { body: { data: [subscription] } } })
    expect(await driver.subscriptions(payer)).toEqual([summarizePaddleSubscription(subscription)])
    expect(sent[1]!.url.searchParams.get('customer_id')).toBe(CUSTOMER.id)
    expect(summarizePaddleSubscription(subscription)).toEqual({
      id: subscription.id,
      status: 'active',
      price: { id: 'pri_01gsz8x8sawmvhz1pv30nge1ke', name: 'Monthly', amount: { amount: 2900, currency: 'usd' }, interval: 'month' },
      currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
      cancelAtPeriodEnd: false,
      raw: subscription,
    })
    expect(summarizePaddleSubscription({ id: 'sub_x', status: 'mystery' }).status).toBe('unknown')
  })
})

describe('Paddle driver - webhooks', () => {
  function delivery(body: object, options: { ts?: number, secret?: string, extraH1?: string } = {}) {
    const payload = JSON.stringify(body)
    const ts = options.ts ?? NOW
    const h1 = paddleSignature(ts, payload, options.secret ?? SECRET)
    return { payload, headers: { 'Paddle-Signature': `ts=${ts};${options.extraH1 ? `h1=${options.extraH1};` : ''}h1=${h1}` } }
  }

  const completed = {
    event_id: 'evt_01hv8m0nfz2dxhfxyf2k3cmkpa',
    event_type: 'transaction.completed',
    occurred_at: '2026-10-06T12:00:00Z',
    notification_id: 'ntf_01hv8m0nhxr1gfzh0c0zrq3vbb',
    data: { id: 'txn_01hv8m0mnx3sj85e7gxc6kga03', status: 'completed', custom_data: { reference: 'order-3' }, details: { totals: { grand_total: '2999', currency_code: 'EUR' } } },
  }

  it('verifies a delivery and names it in our terms', async () => {
    const [event] = await paddle().driver.verifyWebhook(delivery(completed))
    expect(event).toEqual({
      provider: 'paddle',
      id: 'evt_01hv8m0nfz2dxhfxyf2k3cmkpa',
      type: 'payment.succeeded',
      providerType: 'transaction.completed',
      reference: 'txn_01hv8m0mnx3sj85e7gxc6kga03',
      merchantReference: 'order-3',
      amount: { amount: 2999, currency: 'eur' },
      reason: null,
      raw: completed,
    })
  })

  it('accepts any h1 while Paddle rotates a secret', async () => {
    const events = await paddle().driver.verifyWebhook(delivery(completed, { extraH1: 'f'.repeat(64) }))
    expect(events[0]!.type).toBe('payment.succeeded')
  })

  it('refuses a forged, stale or unsigned delivery, and says when it is not configured', async () => {
    const { driver } = paddle()
    await expect(driver.verifyWebhook(delivery(completed, { secret: 'another' }))).rejects.toBeInstanceOf(WebhookSignatureError)
    await expect(driver.verifyWebhook(delivery(completed, { ts: NOW - 60 }))).rejects.toThrow('seconds from now')
    await expect(driver.verifyWebhook({ payload: '{}', headers: {} })).rejects.toThrow('no Paddle-Signature header')
    await expect(driver.verifyWebhook({ payload: '{}', headers: { 'paddle-signature': 'nonsense' } })).rejects.toThrow('ts=...;h1=...')

    // The body as received is what is signed: re-serialising it breaks the match.
    const signed = delivery(completed)
    await expect(driver.verifyWebhook({ ...signed, payload: JSON.stringify(completed, null, 2) })).rejects.toThrow('another key')

    const unconfigured = paddle({}, { webhookSecret: undefined })
    await expect(unconfigured.driver.verifyWebhook(signed)).rejects.toBeInstanceOf(WebhookNotConfiguredError)
  })

  it('reports a failed payment with the attempt\'s error code', async () => {
    const failed = { ...completed, event_type: 'transaction.payment_failed', data: { ...completed.data, status: 'ready', payments: [{ status: 'error', error_code: 'declined' }] } }
    const [event] = await paddle().driver.verifyWebhook(delivery(failed))
    expect(event).toMatchObject({ type: 'payment.failed', reason: 'declined' })
  })

  it('counts a refund once, however many events report its approval', async () => {
    const adjustment = { id: 'adj_01hvgf2s84dr6reszzg29zbvcm', action: 'refund', transaction_id: 'txn_01hv8m0mnx3sj85e7gxc6kga03', status: 'approved', totals: { total: '1200', currency_code: 'USD' } }
    const { driver } = paddle()
    const [created] = await driver.verifyWebhook(delivery({ ...completed, event_id: 'evt_1', event_type: 'adjustment.created', data: adjustment }))
    const [updated] = await driver.verifyWebhook(delivery({ ...completed, event_id: 'evt_2', event_type: 'adjustment.updated', data: adjustment }))

    expect(created).toMatchObject({ type: 'refund.succeeded', reference: adjustment.transaction_id, amount: { amount: 1200, currency: 'usd' } })
    // The dedup key is the refund, not the event, so commerce adds it once.
    expect(created!.id).toBe(updated!.id)

    const [pending] = await driver.verifyWebhook(delivery({ ...completed, event_id: 'evt_3', event_type: 'adjustment.created', data: { ...adjustment, status: 'pending_approval' } }))
    expect(pending).toMatchObject({ type: 'unknown', id: 'evt_3' })

    const [rejected] = await driver.verifyWebhook(delivery({ ...completed, event_id: 'evt_4', event_type: 'adjustment.updated', data: { ...adjustment, status: 'rejected', reason: 'outside the refund window' } }))
    expect(rejected).toMatchObject({ type: 'refund.failed', reason: 'outside the refund window' })
  })

  it('names subscription events, and leaves the rest unknown', async () => {
    const { driver } = paddle()
    const type = async (eventType: string) => (await driver.verifyWebhook(delivery({ ...completed, event_type: eventType, data: { id: 'sub_1' } })))[0]!.type
    expect(await type('subscription.created')).toBe('subscription.created')
    expect(await type('subscription.past_due')).toBe('subscription.updated')
    expect(await type('subscription.canceled')).toBe('subscription.canceled')
    expect(await type('customer.updated')).toBe('unknown')
  })

  it('acknowledges with a 200', () => {
    expect(paddle().driver.acknowledgeWebhook().status).toBe(200)
  })

  it('reads a Paddle-Signature header', () => {
    expect(parsePaddleSignature('ts=1671552777;h1=eb4d0dc8853be92b7f063b9f3ba5233eb920a09459b6e6b2c26705b4364db151'))
      .toEqual({ timestamp: 1671552777, signatures: ['eb4d0dc8853be92b7f063b9f3ba5233eb920a09459b6e6b2c26705b4364db151'] })
    expect(parsePaddleSignature('h1=abc')).toBeNull()
  })
})
