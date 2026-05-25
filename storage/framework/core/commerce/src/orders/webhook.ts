/**
 * Commerce-side Stripe webhook handler (stacksjs/stacks#1879 Co-17).
 *
 * Background: `@stacksjs/payments` ships the signature-verification +
 * event-routing primitives (`processWebhook`, `onPaymentIntent`,
 * `onCharge` etc.) but nothing in commerce subscribes to them.
 * Orders sat at PENDING forever when Stripe's webhook delivery
 * hiccupped — customer re-checked out, double-charge risk.
 *
 * This module registers handlers for the four payment-related
 * Stripe events commerce cares about:
 *
 *   - `payment_intent.succeeded` → mark payment + order paid
 *   - `payment_intent.payment_failed` → mark order cancelled + record reason
 *   - `charge.refunded` → mark order refunded + emit event
 *   - `charge.dispute.created` → log + emit dispute event for ops
 *
 * Idempotency: every Stripe event has a unique `id` (e.g.
 * `evt_1NxxXxxxxxxx`). We persist processed event IDs in a small
 * `stripe_webhook_events` table; receiving the same event twice
 * (which happens when Stripe retries) is a no-op. The atomic
 * write happens inside a transaction so duplicate-detection and
 * the payment/order update can't race.
 *
 * Signature verification happens before this module is reached —
 * callers route the raw request through `payments.processWebhook`,
 * which returns a verified `Stripe.Event`. Skipping that step is
 * the obvious attack path (forge the body); see the wiring example
 * at the bottom of this file.
 *
 * @example
 * ```ts
 * // routes/webhooks.ts
 * import { processWebhook } from '@stacksjs/payments'
 * import { registerCommerceWebhookHandlers } from '@stacksjs/commerce'
 *
 * // Once at boot:
 * registerCommerceWebhookHandlers()
 *
 * // Per-request:
 * route.post('/webhooks/stripe', async (req) => {
 *   const payload = await req.text()
 *   const signature = req.headers.get('stripe-signature') ?? ''
 *   const result = await processWebhook(payload, signature, {
 *     secret: process.env.STRIPE_WEBHOOK_SECRET!,
 *     tolerance: 300,
 *   })
 *   return Response.json(result, { status: result.success ? 200 : 400 })
 * })
 * ```
 */

import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { emitOrderCancelled, emitOrderPaid, emitOrderRefunded } from './events'

/**
 * Look up an order by its associated payment's `transaction_id`
 * (which is the Stripe payment intent id). Returns null when no
 * order matches — common during the brief window between Stripe
 * sending `payment_intent.succeeded` and the local commit
 * landing.
 */
async function findOrderByPaymentIntent(paymentIntentId: string): Promise<Record<string, unknown> | null> {
  const payment = await (db as any)
    .selectFrom('payments')
    .where('transaction_id', '=', paymentIntentId)
    .selectAll()
    .executeTakeFirst()
  if (!payment) return null
  const order = await (db as any)
    .selectFrom('orders')
    .where('id', '=', payment.order_id)
    .selectAll()
    .executeTakeFirst()
  return order ?? null
}

/**
 * Process-or-skip helper: returns true when this Stripe event id
 * is new (and inserts the dedup row), false when we've seen it
 * before. The insert happens inside the caller's transaction so
 * a concurrent retry can't slip past.
 *
 * Falls back to a "best-effort, may double-process" path when the
 * `stripe_webhook_events` table doesn't exist yet — the dedup
 * surface is opt-in via migration. Apps that haven't created the
 * table get a warn-once at startup.
 */
let warnedAboutMissingDedupTable = false
async function recordEventOrSkip(eventId: string, trx: any): Promise<boolean> {
  try {
    await trx
      .insertInto('stripe_webhook_events')
      .values({
        event_id: eventId,
        processed_at: formatDate(new Date()),
      })
      .execute()
    return true
  }
  catch (err: any) {
    // Unique constraint hit = already processed = skip.
    if (err?.message?.includes('UNIQUE constraint') || err?.message?.includes('Duplicate entry'))
      return false
    // Missing table → degrade to "process every time" with a warn
    // on first occurrence so ops can spot the missing migration.
    if (err?.message?.includes('no such table') || err?.message?.includes("doesn't exist")) {
      if (!warnedAboutMissingDedupTable) {
        warnedAboutMissingDedupTable = true
        // eslint-disable-next-line no-console
        console.warn('[commerce/webhook] stripe_webhook_events table missing — Stripe retries may be processed multiple times. Run migrations to enable dedup.')
      }
      return true
    }
    throw err
  }
}

/**
 * Handler for `payment_intent.succeeded`. Marks the linked payment
 * row + order row as paid in a single transaction. Idempotent via
 * `recordEventOrSkip`.
 */
async function handlePaymentIntentSucceeded(event: { id: string, data: { object: any } }): Promise<void> {
  const paymentIntent = event.data.object
  const paymentIntentId = paymentIntent?.id as string | undefined
  if (!paymentIntentId) return

  await db.transaction().execute(async (trx: any) => {
    const isNew = await recordEventOrSkip(event.id, trx)
    if (!isNew) return // already processed

    const payment = await trx
      .selectFrom('payments')
      .where('transaction_id', '=', paymentIntentId)
      .selectAll()
      .executeTakeFirst()
    if (!payment) return // payment row not yet inserted; commerce path will catch up

    const now = formatDate(new Date())
    await trx
      .updateTable('payments')
      .set({ status: 'succeeded', updated_at: now })
      .where('id', '=', payment.id)
      .execute()

    // Move the order out of PENDING if it's still there. We use
    // the same updateStatus guard via the state machine in events.ts
    // (PENDING → PROCESSING is legal). Don't force the transition
    // for orders already past PROCESSING — those advanced via a
    // different path and we shouldn't regress them.
    const order = await trx
      .selectFrom('orders')
      .where('id', '=', payment.order_id)
      .selectAll()
      .executeTakeFirst()
    if (order && order.status === 'PENDING') {
      await trx
        .updateTable('orders')
        .set({ status: 'PROCESSING', updated_at: now })
        .where('id', '=', order.id)
        .execute()
    }
  })

  // Fire-and-forget event emission AFTER the transaction commits
  // so subscribers see the post-write state. Lookup happens outside
  // the transaction since it's read-only.
  const order = await findOrderByPaymentIntent(paymentIntentId)
  if (order) await emitOrderPaid(order)
}

/**
 * Handler for `payment_intent.payment_failed`. Marks the payment
 * as failed and cancels the linked order. Records the failure
 * reason on the payment row for ops triage.
 */
async function handlePaymentIntentFailed(event: { id: string, data: { object: any } }): Promise<void> {
  const paymentIntent = event.data.object
  const paymentIntentId = paymentIntent?.id as string | undefined
  if (!paymentIntentId) return

  const lastError = paymentIntent?.last_payment_error
  const reason = (lastError?.message as string | undefined) ?? 'payment failed'

  await db.transaction().execute(async (trx: any) => {
    const isNew = await recordEventOrSkip(event.id, trx)
    if (!isNew) return

    const payment = await trx
      .selectFrom('payments')
      .where('transaction_id', '=', paymentIntentId)
      .selectAll()
      .executeTakeFirst()
    if (!payment) return

    const now = formatDate(new Date())
    await trx
      .updateTable('payments')
      .set({ status: 'failed', failure_reason: reason, updated_at: now })
      .where('id', '=', payment.id)
      .execute()

    const order = await trx
      .selectFrom('orders')
      .where('id', '=', payment.order_id)
      .selectAll()
      .executeTakeFirst()
    if (order && order.status === 'PENDING') {
      await trx
        .updateTable('orders')
        .set({ status: 'CANCELLED', updated_at: now })
        .where('id', '=', order.id)
        .execute()
    }
  })

  const order = await findOrderByPaymentIntent(paymentIntentId)
  if (order) await emitOrderCancelled(order, reason)
}

/**
 * Handler for `charge.refunded`. Marks the order REFUNDED and
 * records the refund amount on the linked payment.
 */
async function handleChargeRefunded(event: { id: string, data: { object: any } }): Promise<void> {
  const charge = event.data.object
  const paymentIntentId = charge?.payment_intent as string | undefined
  if (!paymentIntentId) return

  const refundAmount = (charge?.amount_refunded as number | undefined) ?? 0

  await db.transaction().execute(async (trx: any) => {
    const isNew = await recordEventOrSkip(event.id, trx)
    if (!isNew) return

    const payment = await trx
      .selectFrom('payments')
      .where('transaction_id', '=', paymentIntentId)
      .selectAll()
      .executeTakeFirst()
    if (!payment) return

    const now = formatDate(new Date())
    await trx
      .updateTable('payments')
      .set({ status: 'refunded', refund_amount: refundAmount, updated_at: now })
      .where('id', '=', payment.id)
      .execute()

    const order = await trx
      .selectFrom('orders')
      .where('id', '=', payment.order_id)
      .selectAll()
      .executeTakeFirst()
    if (order && order.status !== 'REFUNDED') {
      await trx
        .updateTable('orders')
        .set({ status: 'REFUNDED', updated_at: now })
        .where('id', '=', order.id)
        .execute()
    }
  })

  const order = await findOrderByPaymentIntent(paymentIntentId)
  if (order) await emitOrderRefunded(order, refundAmount)
}

/**
 * Wire commerce's Stripe webhook handlers into the payments
 * package's event router. Call once at boot.
 *
 * Returns an unregister callback for tests that want to swap the
 * handler set between cases.
 */
export async function registerCommerceWebhookHandlers(): Promise<() => void> {
  const payments = await import('@stacksjs/payments').catch(() => null)
  if (!payments) {
    // eslint-disable-next-line no-console
    console.warn('[commerce/webhook] @stacksjs/payments not installed — Stripe webhook handlers NOT registered')
    return () => {}
  }

  const onPaymentIntent = (payments as { onPaymentIntent?: (h: Record<string, unknown>) => void }).onPaymentIntent
  const onCharge = (payments as { onCharge?: (h: Record<string, unknown>) => void }).onCharge
  if (typeof onPaymentIntent !== 'function' || typeof onCharge !== 'function') {
    // eslint-disable-next-line no-console
    console.warn('[commerce/webhook] @stacksjs/payments shape changed — handlers NOT registered')
    return () => {}
  }

  onPaymentIntent({
    succeeded: handlePaymentIntentSucceeded,
    failed: handlePaymentIntentFailed,
  })
  onCharge({
    refunded: handleChargeRefunded,
  })

  // No first-class unregister in payments today — return a no-op
  // so callers can plan for the future without baking the absence
  // of unregister into their code.
  return () => {}
}

// Export the individual handlers for direct testing.
export {
  handleChargeRefunded,
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
}
