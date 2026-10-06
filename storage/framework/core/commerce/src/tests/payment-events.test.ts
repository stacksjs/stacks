import type { PaymentEvent } from '@stacksjs/payments'
import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { handleCommercePaymentEvent } from '../orders/webhook'
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
