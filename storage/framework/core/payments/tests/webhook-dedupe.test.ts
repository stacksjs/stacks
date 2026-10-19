import type Stripe from 'stripe'
import { createHmac } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'bun:test'
import { config, services } from '@stacksjs/config'

/**
 * Stripe delivers at least once, so a replayed event (same `evt_` id) must not
 * run its handlers twice, and a handler that threw must leave the event to the
 * provider's retry. The driver path must also honour a configured signature
 * tolerance, which it used to drop.
 */

const SECRET = 'whsec_test_dedupe'

function sign(body: string, at = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac('sha256', SECRET).update(`${at}.${body}`).digest('hex')
  return `t=${at},v1=${mac}`
}

let webhook: typeof import('../src/billable/webhook')
let events: typeof import('../src/billable/webhook-events')

beforeAll(async () => {
  // The Stripe client is a lazy proxy that demands a key on first property
  // access. Verification never calls the API, so any well-formed test key does.
  ;(services as any).stripe = { ...(services as any).stripe, secretKey: 'sk_test_dedupe' }
  webhook = await import('../src/billable/webhook')
  events = await import('../src/billable/webhook-events')
})

let typeCounter = 0
/** A fresh event type per test, since the handler registry is process-wide. */
function freshType(): string {
  typeCounter += 1
  return `test.dedupe_${typeCounter}_${crypto.randomUUID().slice(0, 8)}`
}

function event(type: string, id?: string): Stripe.Event {
  return { ...(id ? { id } : {}), object: 'event', type, data: { object: {} } } as unknown as Stripe.Event
}

describe('handleWebhookEvent dedupe', () => {
  it('runs the handlers once for a replayed event id', async () => {
    const type = freshType()
    const store = events.memoryWebhookEventStore()
    let calls = 0
    webhook.onWebhookEvent(type, () => { calls += 1 })

    const first = await webhook.handleWebhookEvent(event(type, 'evt_replay'), { store })
    const second = await webhook.handleWebhookEvent(event(type, 'evt_replay'), { store })

    expect(calls).toBe(1)
    expect(first.duplicate).toBeUndefined()
    expect(second).toEqual({ handled: true, eventType: type, duplicate: true })
  })

  it('does not record an event whose handler threw, so the retry runs it', async () => {
    const type = freshType()
    const store = events.memoryWebhookEventStore()
    let calls = 0
    webhook.onWebhookEvent(type, () => {
      calls += 1
      if (calls === 1) throw new Error('database unavailable')
    })

    const failed = await webhook.handleWebhookEvent(event(type, 'evt_retry'), { store })
    expect(failed.errors).toEqual(['database unavailable'])
    expect(await store.has('evt_retry')).toBe(false)

    const retried = await webhook.handleWebhookEvent(event(type, 'evt_retry'), { store })
    expect(retried.errors).toBeUndefined()
    expect(retried.duplicate).toBeUndefined()
    expect(calls).toBe(2)

    const replayed = await webhook.handleWebhookEvent(event(type, 'evt_retry'), { store })
    expect(replayed.duplicate).toBe(true)
    expect(calls).toBe(2)
  })

  it('runs a concurrent second delivery of the same id once, and answers both', async () => {
    const type = freshType()
    const store = events.memoryWebhookEventStore()
    let calls = 0
    webhook.onWebhookEvent(type, async () => {
      calls += 1
      await Bun.sleep(10)
    })

    const [a, b] = await Promise.all([
      webhook.handleWebhookEvent(event(type, 'evt_parallel'), { store }),
      webhook.handleWebhookEvent(event(type, 'evt_parallel'), { store }),
    ])
    expect(calls).toBe(1)
    expect(a.handled && b.handled).toBe(true)
  })

  it('can be turned off', async () => {
    const type = freshType()
    const store = events.memoryWebhookEventStore()
    let calls = 0
    webhook.onWebhookEvent(type, () => { calls += 1 })

    await webhook.handleWebhookEvent(event(type, 'evt_off'), { store, dedupe: false })
    await webhook.handleWebhookEvent(event(type, 'evt_off'), { store, dedupe: false })
    expect(calls).toBe(2)
  })

  it('never dedupes an event without an id', async () => {
    const type = freshType()
    let calls = 0
    webhook.onWebhookEvent(type, () => { calls += 1 })

    await webhook.handleWebhookEvent(event(type))
    await webhook.handleWebhookEvent(event(type))
    expect(calls).toBe(2)
  })

  it('does not record an event no handler is registered for', async () => {
    const store = events.memoryWebhookEventStore()
    const result = await webhook.handleWebhookEvent(event(freshType(), 'evt_unhandled'), { store })
    expect(result.handled).toBe(false)
    expect(await store.has('evt_unhandled')).toBe(false)
  })

  it('uses the store set as the default', async () => {
    const type = freshType()
    const store = events.memoryWebhookEventStore()
    events.setWebhookEventStore(store)
    try {
      let calls = 0
      webhook.onWebhookEvent(type, () => { calls += 1 })
      await webhook.handleWebhookEvent(event(type, 'evt_default'))
      await webhook.handleWebhookEvent(event(type, 'evt_default'))
      expect(calls).toBe(1)
      expect(await store.has('evt_default')).toBe(true)
    }
    finally {
      events.setWebhookEventStore(null)
    }
  })
})

describe('processWebhook dedupe', () => {
  it('acknowledges a replayed signed delivery without running its handlers again', async () => {
    const type = freshType()
    const store = events.memoryWebhookEventStore()
    let calls = 0
    webhook.onWebhookEvent(type, () => { calls += 1 })
    const body = JSON.stringify({ id: 'evt_signed_replay', object: 'event', type, data: { object: {} } })

    const first = await webhook.processWebhook(body, sign(body), { secret: SECRET, store })
    const second = await webhook.processWebhook(body, sign(body), { secret: SECRET, store })

    expect(first).toEqual({ success: true, eventType: type })
    expect(second).toEqual({ success: true, eventType: type, duplicate: true })
    expect(calls).toBe(1)
  })

  it('reports a failed handler and lets the retry through', async () => {
    const type = freshType()
    const store = events.memoryWebhookEventStore()
    let calls = 0
    webhook.onWebhookEvent(type, () => {
      calls += 1
      if (calls === 1) throw new Error('boom')
    })
    const body = JSON.stringify({ id: 'evt_signed_retry', object: 'event', type, data: { object: {} } })

    expect((await webhook.processWebhook(body, sign(body), { secret: SECRET, store })).success).toBe(false)
    expect(await webhook.processWebhook(body, sign(body), { secret: SECRET, store })).toEqual({ success: true, eventType: type })
    expect(calls).toBe(2)
  })

  it('passes tolerance to signature verification', async () => {
    const body = JSON.stringify({ id: 'evt_old', object: 'event', type: freshType(), data: { object: {} } })
    const tenMinutesAgo = sign(body, Math.floor(Date.now() / 1000) - 600)

    const strict = await webhook.processWebhook(body, tenMinutesAgo, { secret: SECRET, tolerance: 60 })
    expect(strict.success).toBe(false)
    expect(strict.error).toMatch(/tolerance|timestamp/i)

    const lenient = await webhook.processWebhook(body, tenMinutesAgo, { secret: SECRET, tolerance: 3600 })
    expect(lenient.success).toBe(true)
  })
})

describe('memoryWebhookEventStore', () => {
  it('forgets an id after its time to live', async () => {
    let now = 1_000_000
    const store = events.memoryWebhookEventStore({ ttlSeconds: 60, now: () => now })
    await store.add('evt_ttl')
    expect(await store.has('evt_ttl')).toBe(true)
    now += 61_000
    expect(await store.has('evt_ttl')).toBe(false)
  })

  it('drops the oldest ids past its size bound', async () => {
    const store = events.memoryWebhookEventStore({ maxEntries: 2 })
    await store.add('evt_1')
    await store.add('evt_2')
    await store.add('evt_3')
    expect(await store.has('evt_1')).toBe(false)
    expect(await store.has('evt_3')).toBe(true)
  })
})

describe('the Stripe driver passes tolerance through', () => {
  it('hands the configured tolerance to constructEvent', async () => {
    const { StripeDriver } = await import('../src/driver/stripe')
    const seen: Array<number | undefined> = []
    const driver = new StripeDriver({
      webhookSecret: SECRET,
      webhookTolerance: 42,
      operations: {
        constructEvent: async (_payload: string, _signature: string, _secret: string, tolerance?: number) => {
          seen.push(tolerance)
          return { id: 'evt_1', type: 'charge.succeeded', data: { object: {} } } as unknown as Stripe.Event
        },
      } as never,
    })
    await driver.verifyWebhook({ payload: '{}', headers: { 'stripe-signature': 't=1,v1=x' } })
    expect(seen).toEqual([42])
  })

  it('paymentDriver() reads payment.stripe.webhookTolerance and verifies with it', async () => {
    const { paymentDriver } = await import('../src/driver')
    const payment = (config as any).payment
    const saved = payment?.stripe
    ;(config as any).payment = { ...payment, driver: 'stripe', stripe: { ...saved, webhookSecret: SECRET, webhookTolerance: 60 } }
    try {
      const body = JSON.stringify({ id: 'evt_driver_old', object: 'event', type: 'charge.succeeded', data: { object: { id: 'ch_1' } } })
      const tenMinutesAgo = sign(body, Math.floor(Date.now() / 1000) - 600)
      await expect(paymentDriver('stripe').verifyWebhook({ payload: body, headers: { 'stripe-signature': tenMinutesAgo } })).rejects.toThrow(/does not verify/)

      ;(config as any).payment.stripe.webhookTolerance = 3600
      const verified = await paymentDriver('stripe').verifyWebhook({ payload: body, headers: { 'stripe-signature': tenMinutesAgo } })
      expect(verified[0]!.id).toBe('evt_driver_old')
    }
    finally {
      ;(config as any).payment = payment
    }
  })
})
