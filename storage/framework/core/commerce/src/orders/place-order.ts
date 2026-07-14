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
import { emitOrderCreated, emitOrderPaid } from './events'

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
  /**
   * Optional caller-supplied idempotency key (stacksjs/stacks#1879
   * Co-3). When set, the order is recorded against this key in a
   * dedup side-table; a retry with the same key returns the
   * original order id instead of creating a duplicate. Use this
   * when a user might double-click "place order" (network blip,
   * impatient retry, mobile background-sync race). UUID per
   * logical checkout attempt is typical; server-side `userId +
   * cartId` also works.
   */
  idempotencyKey?: string
}

/**
 * Discriminated result. `ok: true` means the order, payment, and
 * inventory all committed; `ok: false` carries a `reason` so the
 * caller can surface a specific error to the user.
 */
export type PlaceOrderResult =
  | { ok: true, order: OrderJsonResponse, payment?: PaymentJsonResponse }
  | { ok: false, reason: 'out-of-stock' | 'duplicate-payment' | 'duplicate-idempotency-key' | 'unknown', failedAt?: string, error?: unknown }

/**
 * Look up an existing order by idempotency key — returns the
 * original order when this key has been seen before, null when it
 * hasn't. Degrades to "always null" with a startup warn when the
 * `order_idempotency` dedup table isn't migrated yet.
 */
let warnedAboutMissingOrderIdempotencyTable = false

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

async function findOrderByIdempotencyKey(key: string): Promise<OrderJsonResponse | null> {
  try {
    const row = await (db as any)
      .selectFrom('order_idempotency')
      .where('idempotency_key', '=', key)
      .selectAll()
      .executeTakeFirst()
    if (!row) return null
    const order = await (db as any)
      .selectFrom('orders')
      .where('id', '=', row.order_id)
      .selectAll()
      .executeTakeFirst()
    return (order ?? null) as OrderJsonResponse | null
  }
  catch (err: any) {
    if (isMissingTableError(err)) {
      if (!warnedAboutMissingOrderIdempotencyTable) {
        warnedAboutMissingOrderIdempotencyTable = true
        // eslint-disable-next-line no-console
        console.warn('[commerce/orders] order_idempotency table missing — idempotency keys are accepted but NOT enforced. Run migrations to enable dedup.')
      }
      return null
    }
    throw err
  }
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  // Idempotency-key short-circuit (stacksjs/stacks#1879 Co-3).
  // Before doing any work, check the dedup side-table — a retry
  // with the same key returns the original order without
  // re-running the transaction. Insert-into-dedup happens AFTER
  // the order successfully commits, so a partial failure (e.g.,
  // the original placeOrder threw mid-transaction) doesn't
  // permanently lock the key.
  if (input.idempotencyKey) {
    const existing = await findOrderByIdempotencyKey(input.idempotencyKey)
    if (existing)
      return { ok: true, order: existing }
  }

  try {
    const result = await db.transaction(async (trx: any) => {
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

      // 4. Record the idempotency key inside the transaction so a
      // concurrent retry of the same key (the classic double-click
      // scenario) hits the unique constraint and rolls back here
      // instead of creating a second order. Skipped silently when
      // the table isn't migrated yet — same opt-in pattern as the
      // Stripe webhook dedup.
      if (input.idempotencyKey) {
        try {
          await trx
            .insertInto('order_idempotency')
            .values({
              idempotency_key: input.idempotencyKey,
              order_id: orderId,
              created_at: now,
            })
            .execute()
        }
        catch (err: any) {
          // Unique-constraint collision = concurrent retry won the
          // race; abort this transaction so the caller falls back
          // to the existing order via the pre-transaction lookup
          // on the next attempt (or right now if they re-call).
          if (err?.message?.includes('UNIQUE constraint') || err?.message?.includes('Duplicate entry'))
            throw Object.assign(new Error('idempotency-key collision'), { __placeFail: true, failedAt: 'idempotency', reason: 'duplicate-idempotency-key' })
          // Missing table: degrade silently (the pre-transaction
          // lookup already warned).
          if (!isMissingTableError(err))
            throw err
        }
      }

      // 5. Refetch the order so callers get the post-write canonical row.
      const order = await trx.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst() as OrderJsonResponse | undefined
      if (!order)
        throw Object.assign(new Error('order disappeared mid-transaction'), { __placeFail: true, failedAt: 'order', reason: 'unknown' })

      return { order, payment: paymentRow }
    })

    // Fire `order:created` AFTER the transaction commits (#1879
    // Co-18). If a payment row also landed, also emit `order:paid`
    // — the placeOrder path is the typical "checkout completed
    // successfully" entry point. Both fire-and-forget; emission
    // failures never undo the write.
    void emitOrderCreated(result.order as unknown as Record<string, unknown>)
    if (result.payment) {
      void emitOrderPaid(
        result.order as unknown as Record<string, unknown>,
        result.payment as unknown as Record<string, unknown>,
      )
    }

    return { ok: true, order: result.order, payment: result.payment }
  }
  catch (err: any) {
    if (err?.__placeFail) {
      return {
        ok: false,
        reason: err.reason as Extract<PlaceOrderResult, { ok: false }>['reason'],
        failedAt: err.failedAt,
        error: err,
      }
    }
    // Genuinely unexpected error — surface up so the global error
    // handler can log it. Transaction already rolled back.
    throw err
  }
}
