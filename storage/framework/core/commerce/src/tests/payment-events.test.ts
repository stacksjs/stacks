import type { PaymentDriver, PaymentEvent } from '@stacksjs/payments'
import { WebhookNotConfiguredError, WebhookSignatureError } from '@stacksjs/payments'
import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { handleCommercePaymentEvent, receivePaymentWebhook } from '../orders/webhook'
import { refreshDatabase } from './setup'

/**
 * Payment webhooks applied to orders, from any provider (stacksjs/stacks#665).
 * The handlers take the payment driver's `PaymentEvent`; they used to take
 * Stripe events through a registration nothing called.
 */

function event(overrides: Partial<PaymentEvent>): PaymentEvent {
  return { provider: 'stripe', id: 'evt_1', type: 'payment.succeeded', providerType: 'test', reference: 'pi_1', merchantReference: null, amount: null, reason: null, raw: {}, ...overrides }
}

async function seed(transactionId: string, paid = false): Promise<{ orderId: number }> {
  const now = formatDate(new Date())
  await db.insertInto('orders').values({ status: paid ? 'PROCESSING' : 'PENDING', order_type: 'delivery', total_amount: 2500, created_at: now }).execute()
  const order = await db.selectFrom('orders').selectAll().orderBy('id', 'desc').executeTakeFirst()
  await db.insertInto('payments').values({ order_id: order!.id, transaction_id: transactionId, amount: 2500, method: 'creditCard', status: paid ? 'succeeded' : 'pending', created_at: now }).execute()
  return { orderId: Number(order!.id) }
}

async function state(orderId: number, transactionId: string) {
  const order = await db.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst()
  const payment = await db.selectFrom('payments').where('transaction_id', '=', transactionId).selectAll().executeTakeFirst()
  return { order: order?.status, payment: payment?.status, refunded: payment?.refund_amount, reason: payment?.failure_reason }
}

const refund = (id: string, reference: string, amount: number) =>
  event({ id, type: 'refund.succeeded', reference, amount: { amount, currency: 'usd' } })

beforeEach(async () => {
  await refreshDatabase()
})

describe('handleCommercePaymentEvent', () => {
  it('marks a paid order processing, from a Stripe or an Adyen reference alike', async () => {
    const stripe = await seed('pi_1')
    const adyen = await seed('8835511210681234')

    expect(await handleCommercePaymentEvent(event({ id: 'evt_a', reference: 'pi_1' }))).toBe(true)
    expect(await handleCommercePaymentEvent(event({ id: 'AUTHORISATION:8835511210681234', reference: '8835511210681234' }))).toBe(true)

    expect(await state(stripe.orderId, 'pi_1')).toMatchObject({ order: 'PROCESSING', payment: 'succeeded' })
    expect(await state(adyen.orderId, '8835511210681234')).toMatchObject({ order: 'PROCESSING', payment: 'succeeded' })
  })

  it('cancels the order on a failed payment, with the provider\'s reason', async () => {
    const { orderId } = await seed('pi_2')
    await handleCommercePaymentEvent(event({ id: 'evt_b', type: 'payment.failed', reference: 'pi_2', reason: 'Your card was declined.' }))
    expect(await state(orderId, 'pi_2')).toMatchObject({ order: 'CANCELLED', payment: 'failed', reason: 'Your card was declined.' })
  })

  it('refunds partially, then fully, adding each refund to the last', async () => {
    const { orderId } = await seed('pi_3', true)

    await handleCommercePaymentEvent(refund('evt_c1', 'pi_3', 1000))
    expect(await state(orderId, 'pi_3')).toMatchObject({ order: 'PROCESSING', payment: 'partiallyRefunded', refunded: 1000 })

    await handleCommercePaymentEvent(refund('evt_c2', 'pi_3', 1500))
    expect(await state(orderId, 'pi_3')).toMatchObject({ order: 'REFUNDED', payment: 'refunded', refunded: 2500 })
  })

  it('applies a stated refunded total as the difference from what is recorded', async () => {
    // Lemon Squeezy states the order's refunded total, not the one refund.
    const total = (id: string, amount: number) =>
      event({ provider: 'lemonsqueezy', id, type: 'refund.succeeded', reference: 'ls_1', amount: null, refundedTotal: { amount, currency: 'usd' } })
    const { orderId } = await seed('ls_1', true)

    await handleCommercePaymentEvent(total('order_refunded:a', 1000))
    expect(await state(orderId, 'ls_1')).toMatchObject({ payment: 'partiallyRefunded', refunded: 1000 })

    await handleCommercePaymentEvent(total('order_refunded:b', 2500))
    expect(await state(orderId, 'ls_1')).toMatchObject({ order: 'REFUNDED', payment: 'refunded', refunded: 2500 })

    // The first delivery again, retried late with another id: the total is
    // already past it, so it adds nothing.
    await handleCommercePaymentEvent(total('order_refunded:c', 1000))
    expect(await state(orderId, 'ls_1')).toMatchObject({ payment: 'refunded', refunded: 2500 })
  })

  it('records no stated total beyond the payment', async () => {
    const { orderId } = await seed('ls_2', true)
    await handleCommercePaymentEvent(event({ provider: 'lemonsqueezy', id: 'order_refunded:x', type: 'refund.succeeded', reference: 'ls_2', refundedTotal: { amount: 9000, currency: 'usd' } }))
    expect(await state(orderId, 'ls_2')).toMatchObject({ payment: 'succeeded' })
  })

  it('records no refund larger than what is left', async () => {
    const { orderId } = await seed('pi_5', true)
    await handleCommercePaymentEvent(refund('evt_e1', 'pi_5', 2000))
    await handleCommercePaymentEvent(refund('evt_e2', 'pi_5', 1000))
    expect(await state(orderId, 'pi_5')).toMatchObject({ order: 'PROCESSING', payment: 'partiallyRefunded', refunded: 2000 })
  })

  it('applies a retried delivery once', async () => {
    const { orderId } = await seed('pi_4', true)
    await handleCommercePaymentEvent(refund('evt_d', 'pi_4', 700))
    await handleCommercePaymentEvent(refund('evt_d', 'pi_4', 700))
    expect(await state(orderId, 'pi_4')).toMatchObject({ payment: 'partiallyRefunded', refunded: 700 })

    const rows = await db.selectFrom('payment_webhook_events').selectAll().execute()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ provider: 'stripe', event_id: 'evt_d' })
  })

  it('keys deliveries by provider, so two providers\' ids cannot collide', async () => {
    const { orderId } = await seed('pi_6', true)
    await handleCommercePaymentEvent(refund('same-id', 'pi_6', 500))
    await handleCommercePaymentEvent({ ...refund('same-id', 'pi_6', 500), provider: 'adyen' })
    expect((await state(orderId, 'pi_6')).refunded).toBe(1000)
  })

  it('still applies a payment, warning once, on a database not yet migrated for dedup', async () => {
    const { orderId } = await seed('pi_7')
    // Moved aside rather than dropped: every test in this process shares the schema.
    await db.unsafe('ALTER TABLE payment_webhook_events RENAME TO payment_webhook_events_aside').execute()
    const warnings: unknown[] = []
    const warn = console.warn
    console.warn = (...args: unknown[]) => warnings.push(args[0])
    try {
      await handleCommercePaymentEvent(event({ id: 'evt_f', reference: 'pi_7' }))
    }
    finally {
      console.warn = warn
      await db.unsafe('ALTER TABLE payment_webhook_events_aside RENAME TO payment_webhook_events').execute()
    }
    expect(await state(orderId, 'pi_7')).toMatchObject({ order: 'PROCESSING', payment: 'succeeded' })
    expect(String(warnings[0])).toContain('payment_webhook_events table missing')
  })

  it('leaves events it has no use for', async () => {
    expect(await handleCommercePaymentEvent(event({ type: 'subscription.updated' }))).toBe(false)
  })
})

describe('receivePaymentWebhook', () => {
  /** A driver whose verification is scripted, answering as Adyen does. */
  function driverThat(verify: (payload: string) => PaymentEvent[]): PaymentDriver {
    return {
      verifyWebhook: async ({ payload }: { payload: string }) => verify(payload),
      acknowledgeWebhook: () => new Response('[accepted]', { status: 202 }),
    } as unknown as PaymentDriver
  }
  const delivery = (body = '{}') => new Request('https://app.test/webhooks/payments', { method: 'POST', body })

  it('applies what the driver verified, and answers with the driver\'s acknowledgement', async () => {
    const { orderId } = await seed('pi_8')
    const response = await receivePaymentWebhook(delivery('signed'), driverThat((payload) => {
      expect(payload).toBe('signed') // the body exactly as received
      return [event({ id: 'evt_g', reference: 'pi_8' })]
    }))
    expect(response.status).toBe(202)
    expect(await response.text()).toBe('[accepted]')
    expect(await state(orderId, 'pi_8')).toMatchObject({ order: 'PROCESSING', payment: 'succeeded' })
  })

  it('applies nothing, and says so, while the webhook secret is not configured', async () => {
    const response = await receivePaymentWebhook(delivery(), driverThat(() => {
      throw new WebhookNotConfiguredError('stripe', 'set STRIPE_WEBHOOK_SECRET')
    }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, reason: 'missing-config' })
  })

  it('refuses a delivery whose signature does not verify', async () => {
    const response = await receivePaymentWebhook(delivery(), driverThat(() => {
      throw new WebhookSignatureError('adyen', 'item PSP1 is signed with another key')
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, reason: 'invalid-signature' })
  })

  it('lets any other failure through, so the provider retries', async () => {
    await expect(receivePaymentWebhook(delivery(), driverThat(() => {
      throw new Error('database is locked')
    }))).rejects.toThrow('database is locked')
  })
})
