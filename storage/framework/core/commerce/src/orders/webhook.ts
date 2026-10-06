/**
 * Commerce's payment webhook handling (stacksjs/stacks#1879 Co-17, #665).
 *
 * Orders sat at PENDING forever when a provider's webhook was the only news of
 * a payment. These handlers apply the three events commerce cares about, from
 * whichever provider `config.payment.driver` names:
 *
 *   - `payment.succeeded` -> payment succeeded, order PROCESSING
 *   - `payment.failed` -> payment failed with its reason, order CANCELLED
 *   - `refund.succeeded` -> the refund added to the payment's refunded amount;
 *     payment `refunded` and order REFUNDED once it covers the whole payment,
 *     `partiallyRefunded` (order untouched) until then
 *
 * They take the payment driver's `PaymentEvent`. They used to take Stripe
 * events through `registerCommerceWebhookHandlers()`, which nothing called and
 * which only Stripe could feed. An event's `reference` is the provider's id
 * for the payment - a Stripe PaymentIntent, an Adyen pspReference - which is
 * what an order's `payments.transaction_id` holds.
 *
 * Idempotency: every event's `(provider, id)` is recorded in
 * `payment_webhook_events` (the `PaymentWebhookEvent` model) in the same
 * transaction as the update, so a provider's retry is a no-op. The handlers
 * used to write a `stripe_webhook_events` table no migration created, so every
 * retry was applied again, and a `failure_reason` column the payments table did
 * not have, so every failed payment rolled back instead of cancelling its order.
 *
 * Verify before reaching this: the driver's `verifyWebhook` checks the
 * signature, and an unverified body is the obvious way to forge a payment.
 *
 * @example
 * ```ts
 * import { paymentDriver } from '@stacksjs/payments'
 * import { orders } from '@stacksjs/commerce'
 *
 * route.post('/webhooks/payments', async (request) => {
 *   const payments = paymentDriver()
 *   const events = await payments.verifyWebhook({ payload: await request.text(), headers: request.headers })
 *   for (const event of events)
 *     await orders.handleCommercePaymentEvent(event)
 *   return payments.acknowledgeWebhook()
 * })
 * ```
 */

import type { PaymentEvent } from '@stacksjs/payments'
import { db } from '@stacksjs/database/runtime'
import { formatDate } from '@stacksjs/orm'
import type { OrderStatus } from './events'
import { canTransition, emitOrderCancelled, emitOrderPaid, emitOrderRefunded } from './events'

/**
 * Look up an order by its associated payment's `transaction_id`
 * (which is the Stripe payment intent id). Returns null when no
 * order matches — common during the brief window between Stripe
 * sending `payment_intent.succeeded` and the local commit
 * landing.
 */
async function findOrderByPaymentIntent(paymentIntentId: string): Promise<Record<string, unknown> | null> {
  const payment = await db
    .selectFrom('payments')
    .where('transaction_id', '=', paymentIntentId)
    .selectAll()
    .executeTakeFirst()
  if (!payment) return null
  const order = await db
    .selectFrom('orders')
    .where('id', '=', payment.order_id)
    .selectAll()
    .executeTakeFirst()
  return order ?? null
}

/**
 * Record the event, answering whether it is new. The insert runs in the
 * caller's transaction, so a concurrent retry cannot slip past.
 *
 * Without the table - an app that has not migrated since it was added - the
 * event is applied anyway, with a warning once: double-applying a retry is
 * recoverable, dropping a payment is not.
 */
let warnedAboutMissingDedupTable = false

async function recordEventOrSkip(event: PaymentEvent, trx: any): Promise<boolean> {
  try {
    const now = formatDate(new Date())
    await trx
      .insertInto('payment_webhook_events')
      .values({
        provider: event.provider,
        event_id: event.id,
        processed_at: now,
        created_at: now,
      })
      .execute()
    return true
  }
  catch (err: any) {
    // Unique constraint hit = already processed = skip.
    if (isUniqueViolation(err))
      return false
    if (isMissingTableError(err)) {
      if (!warnedAboutMissingDedupTable) {
        warnedAboutMissingDedupTable = true
        // eslint-disable-next-line no-console
        console.warn('[commerce/webhook] payment_webhook_events table missing - provider retries will be applied again. Run `buddy migrate` to enable dedup.')
      }
      return true
    }
    throw err
  }
}

/**
 * True when the error is just "table not migrated yet". Each dialect phrases
 * it differently; the Postgres form (`relation "..." does not exist` / SQLSTATE
 * 42P01) was previously missed, so this fail-open guard hard-failed on an
 * un-migrated Postgres DB instead of degrading (stacksjs/stacks#1976). Scoped
 * to `undefined_table` so a real `column ... does not exist` bug still throws.
 */
function isMissingTableError(err: unknown): boolean {
  const e = err as { message?: string, code?: string } | null
  const msg = e?.message ?? ''
  return e?.code === '42P01' // postgres SQLSTATE: undefined_table
    || msg.includes('no such table') // sqlite
    || msg.includes("doesn't exist") // mysql
    || /relation "[^"]*" does not exist/i.test(msg) // postgres wording
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { message?: string, code?: string } | null
  const msg = e?.message ?? ''
  return e?.code === '23505' // postgres SQLSTATE: unique_violation
    || msg.includes('UNIQUE constraint') // sqlite
    || msg.includes('Duplicate entry') // mysql
    || /duplicate key value/i.test(msg) // postgres wording
}

/**
 * A payment succeeded. Marks the linked payment row and order row in a single
 * transaction. Idempotent via `recordEventOrSkip`.
 */
async function handlePaymentSucceeded(event: PaymentEvent): Promise<void> {
  const paymentIntentId = event.reference
  if (!paymentIntentId) return

  await db.transaction(async (trx: any) => {
    const isNew = await recordEventOrSkip(event, trx)
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
 * A payment failed. Marks the payment failed and cancels the linked order,
 * recording the provider's reason on the payment row for ops triage.
 */
async function handlePaymentFailed(event: PaymentEvent): Promise<void> {
  const paymentIntentId = event.reference
  if (!paymentIntentId) return

  const reason = event.reason ?? 'payment failed'

  await db.transaction(async (trx: any) => {
    const isNew = await recordEventOrSkip(event, trx)
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
      .set({ status: 'failed', failure_reason: reason.slice(0, 1000), updated_at: now })
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
 * A refund succeeded. Adds it to the payment's refunded amount; a refund that
 * covers what is left marks the payment `refunded` and the order REFUNDED,
 * and a smaller one marks the payment `partiallyRefunded` and leaves the order
 * where it is, since REFUNDED is terminal. It used to mark both refunded on any
 * refund at all, and to overwrite the refunded amount rather than add to it.
 *
 * A refund larger than what is left is not recorded and is logged: the
 * provider has refunded more than this database thinks was taken, which a
 * person needs to look at - most likely the same refund recorded by hand in
 * the dashboard as well.
 */
async function handleRefundSucceeded(event: PaymentEvent): Promise<void> {
  const paymentIntentId = event.reference
  if (!paymentIntentId) return

  const refundAmount = event.amount?.amount ?? 0
  if (!Number.isSafeInteger(refundAmount) || refundAmount <= 0) return

  let fullyRefunded = false
  let applied = false

  await db.transaction(async (trx: any) => {
    const isNew = await recordEventOrSkip(event, trx)
    if (!isNew) return

    const payment = await trx
      .selectFrom('payments')
      .where('transaction_id', '=', paymentIntentId)
      .selectAll()
      .executeTakeFirst()
    if (!payment) return

    const already = Number(payment.refund_amount ?? 0)
    const total = already + refundAmount
    if (total > Number(payment.amount)) {
      // eslint-disable-next-line no-console
      console.warn(`[commerce/webhook] ${event.provider} refunded ${refundAmount} of payment ${payment.id}, which has ${Number(payment.amount) - already} left to refund; not recorded.`)
      return
    }

    fullyRefunded = total === Number(payment.amount)
    const now = formatDate(new Date())
    await trx
      .updateTable('payments')
      .set({ status: fullyRefunded ? 'refunded' : 'partiallyRefunded', refund_amount: total, updated_at: now })
      .where('id', '=', payment.id)
      .execute()
    applied = true

    if (!fullyRefunded) return
    const order = await trx
      .selectFrom('orders')
      .where('id', '=', payment.order_id)
      .selectAll()
      .executeTakeFirst()
    if (order && canTransition(order.status as OrderStatus, 'REFUNDED')) {
      await trx
        .updateTable('orders')
        .set({ status: 'REFUNDED', updated_at: now })
        .where('id', '=', order.id)
        .execute()
    }
  })

  if (!applied) return
  const order = await findOrderByPaymentIntent(paymentIntentId)
  if (order && fullyRefunded) await emitOrderRefunded(order, refundAmount)
}

/**
 * Apply a verified payment event to the order it concerns. Answers whether
 * commerce acted on it; events it has no use for are left alone.
 */
export async function handleCommercePaymentEvent(event: PaymentEvent): Promise<boolean> {
  switch (event.type) {
    case 'payment.succeeded':
      await handlePaymentSucceeded(event)
      return true
    case 'payment.failed':
      await handlePaymentFailed(event)
      return true
    case 'refund.succeeded':
      await handleRefundSucceeded(event)
      return true
    default:
      return false
  }
}

// Export the individual handlers for direct testing.
export {
  handlePaymentFailed,
  handlePaymentSucceeded,
  handleRefundSucceeded,
}
