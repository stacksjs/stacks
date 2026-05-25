/**
 * Atomic order placement (stacksjs/stacks#1879 Co-1).
 *
 * Background: order creation, payment recording, and inventory
 * decrement happened as three separate writes. A failure between
 * steps left the system in a split-brain state:
 *   - Order created but no payment row → reconciliation churn
 *   - Payment created but no inventory decrement → over-sale
 *   - Inventory decremented but order rolled back → phantom stock loss
 *
 * Fix: wrap all three writes in a single `db.transaction`. Either
 * everything commits or nothing does. The Stripe API call (a
 * network round-trip, not a DB write) stays OUTSIDE the transaction
 * to keep the transaction window short — apps that need
 * Stripe-side atomicity already get it via #1876 X-1's idempotency
 * keys (a retry of the local DB after a successful Stripe call
 * returns the same Stripe object).
 *
 * @example
 * ```ts
 * const result = await placeOrder({
 *   order: { customer_id: user.id, total_amount: 12345, ... },
 *   payment: { transaction_id: stripeIntent.id, amount: 12345, ... },
 *   inventory: [
 *     { id: cart.itemA, delta: -2 },
 *     { id: cart.itemB, delta: -1 },
 *   ],
 * })
 * if (!result.ok) {
 *   // Stock changed between cart view and checkout, or payment
 *   // duplicated — caller can show a useful error.
 *   throw new HttpError(409, result.reason)
 * }
 * await sendOrderConfirmation(result.order)
 * ```
 */

import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { sql } from '@stacksjs/database'

type OrderJsonResponse = ModelRow<typeof Order>
type NewOrder = NewModelData<typeof Order>
type PaymentJsonResponse = ModelRow<typeof Payment>
type NewPayment = NewModelData<typeof Payment>

export interface PlaceOrderInput {
  /** Order row fields. UUID / created_at / updated_at are filled in. */
  order: NewOrder
  /** Optional payment row to record alongside the order. */
  payment?: NewPayment
  /** Optional inventory decrements to apply (each delta is signed). */
  inventory?: ReadonlyArray<{ id: number, delta: number }>
}

/**
 * Discriminated result. `ok: true` means the order, payment, and
 * inventory all committed; `ok: false` carries a `reason` so the
 * caller can surface a specific error to the user.
 */
export type PlaceOrderResult =
  | { ok: true, order: OrderJsonResponse, payment?: PaymentJsonResponse }
  | { ok: false, reason: 'out-of-stock' | 'duplicate-payment' | 'unknown', failedAt?: string, error?: unknown }

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  try {
    const result = await db.transaction().execute(async (trx: any) => {
      const now = formatDate(new Date())

      // 1. Insert the order row.
      const orderData = {
        ...input.order,
        status: input.order.status || 'PENDING',
        uuid: randomUUIDv7(),
        created_at: now,
        updated_at: now,
      }
      const orderInsert: any = await trx
        .insertInto('orders')
        .values(orderData as NewOrder)
        .executeTakeFirst()

      const orderId = Number(orderInsert?.insertId) || Number(orderInsert?.numInsertedOrUpdatedRows)
      if (!orderId)
        throw Object.assign(new Error('order insert returned no id'), { __placeFail: true, failedAt: 'order', reason: 'unknown' })

      // 2. Insert the payment row if provided. The transaction_id
      // unique constraint catches duplicate Stripe webhook deliveries
      // (the pre-fix code's Co-19 backstop) — we surface it as a
      // structured result instead of a generic SQL error.
      let paymentRow: PaymentJsonResponse | undefined
      if (input.payment) {
        try {
          const paymentInsert: any = await trx
            .insertInto('payments')
            .values({
              ...input.payment,
              order_id: orderId,
              created_at: now,
              updated_at: now,
            } as NewPayment)
            .executeTakeFirst()
          const paymentId = Number(paymentInsert?.insertId) || Number(paymentInsert?.numInsertedOrUpdatedRows)
          if (paymentId)
            paymentRow = await trx.selectFrom('payments').where('id', '=', paymentId).selectAll().executeTakeFirst() as PaymentJsonResponse | undefined
        }
        catch (err: any) {
          if (err?.message?.includes('UNIQUE constraint') || err?.message?.includes('Duplicate entry'))
            throw Object.assign(new Error('duplicate payment transaction_id'), { __placeFail: true, failedAt: 'payment', reason: 'duplicate-payment' })
          throw Object.assign(err, { __placeFail: true, failedAt: 'payment', reason: 'unknown' })
        }
      }

      // 3. Decrement inventory atomically. Same conditional UPDATE
      // shape as adjustInventoryMany — `inventory_count + delta >=
      // 0` enforces the precondition in the WHERE clause so two
      // concurrent placeOrders for the same last-in-stock item don't
      // both succeed.
      if (input.inventory && input.inventory.length > 0) {
        for (let i = 0; i < input.inventory.length; i++) {
          const { id, delta } = input.inventory[i]!
          if (!Number.isFinite(delta) || delta === 0)
            throw Object.assign(new Error('inventory delta must be a non-zero finite number'), { __placeFail: true, failedAt: 'inventory', reason: 'unknown' })

          const adjResult: any = await trx
            .updateTable('products')
            .set({
              inventory_count: sql`inventory_count + ${delta}`,
              updated_at: now,
            })
            .where('id', '=', id)
            .where(sql`inventory_count + ${delta}`, '>=', 0)
            .execute()

          const affected = Number(
            adjResult?.numUpdatedRows
            ?? adjResult?.[0]?.numUpdatedRows
            ?? adjResult?.numAffectedRows
            ?? 0,
          )
          if (!affected)
            throw Object.assign(new Error(`inventory adjust failed for product ${id}`), { __placeFail: true, failedAt: 'inventory', reason: 'out-of-stock' })
        }
      }

      // 4. Refetch the order so callers get the post-write canonical row.
      const order = await trx.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst() as OrderJsonResponse | undefined
      if (!order)
        throw Object.assign(new Error('order disappeared mid-transaction'), { __placeFail: true, failedAt: 'order', reason: 'unknown' })

      return { order, payment: paymentRow }
    })

    return { ok: true, order: result.order, payment: result.payment }
  }
  catch (err: any) {
    if (err?.__placeFail) {
      return {
        ok: false,
        reason: err.reason as PlaceOrderResult['reason'] extends infer R ? R : never,
        failedAt: err.failedAt,
        error: err,
      }
    }
    // Genuinely unexpected error — surface up so the global error
    // handler can log it. Transaction already rolled back.
    throw err
  }
}
