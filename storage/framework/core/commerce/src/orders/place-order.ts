import type { ModelRow, NewModelData, Order, OrderItem, Payment } from '@stacksjs/orm'
/**
 * Atomic order placement (stacksjs/stacks#1879 Co-1).
 *
 * Background: order creation, line materialization, payment recording,
 * inventory decrement, and idempotency tracking must share one commit
 * boundary. A failure between separate writes previously left the
 * system in a split-brain state:
 *   - Order created but no payment row → reconciliation churn
 *   - Payment created but no inventory decrement → over-sale
 *   - Inventory decremented but order rolled back → phantom stock loss
 *
 * Fix: wrap every database write in a single `db.transaction`. Either
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
import { formatDate, isUniqueViolation } from '@stacksjs/orm'
import { emitOrderCreated, emitOrderPaid } from './events'
import { adjustInventoryOnConnection } from '../utils/inventory-adjustment'

type OrderJsonResponse = ModelRow<typeof Order>
type NewOrder = NewModelData<typeof Order>
type OrderItemJsonResponse = ModelRow<typeof OrderItem>
type PaymentJsonResponse = ModelRow<typeof Payment>
type NewPayment = NewModelData<typeof Payment>

export interface PlaceOrderLineItem {
  productId: number
  quantity: number
  price: number
  specialInstructions?: string
}

export interface PlaceOrderInput {
  /** Order row fields. UUID / created_at / updated_at are filled in. */
  order: NewOrder
  /** Optional order lines to materialize in the same transaction. */
  items?: ReadonlyArray<PlaceOrderLineItem>
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
  | { ok: true, order: OrderJsonResponse, items?: OrderItemJsonResponse[], payment?: PaymentJsonResponse }
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

export async function findOrderByIdempotencyKey(key: string): Promise<OrderJsonResponse | null> {
  try {
    const row = await db
      .selectFrom('order_idempotency')
      .where('idempotency_key', '=', key)
      .selectAll()
      .executeTakeFirst()
    if (!row) return null
    const order = await db
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
        console.warn('[commerce/orders] order_idempotency table missing - idempotency keys are accepted but NOT enforced. Run migrations to enable dedup.')
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
      const orderUuid = randomUUIDv7()
      const orderData = {
        ...input.order,
        status: input.order.status || 'PENDING',
        uuid: orderUuid,
        created_at: now,
        updated_at: now,
      }
      await trx
        .insertInto('orders')
        .values(orderData as NewOrder)
        .executeTakeFirst()

      // Insert metadata varies by driver: SQLite reports lastInsertRowid,
      // MySQL reports insertId, and PostgreSQL requires RETURNING. The
      // model-managed UUID is stable across all of them, so resolve the row
      // by UUID instead of mistaking an affected-row count for its id.
      const insertedOrder = await trx
        .selectFrom('orders')
        .where('uuid', '=', orderUuid)
        .selectAll()
        .executeTakeFirst() as OrderJsonResponse | undefined
      const orderId = Number(insertedOrder?.id)
      if (!Number.isSafeInteger(orderId) || orderId <= 0)
        throw Object.assign(new Error('order insert could not be resolved by uuid'), { __placeFail: true, failedAt: 'order', reason: 'unknown' })

      // 2. Materialize order lines while the order and inventory
      // adjustments are still provisional. This keeps a sale from
      // committing as an empty order when a line insert fails.
      let orderItemRows: OrderItemJsonResponse[] | undefined
      if (input.items && input.items.length > 0) {
        const values = input.items.map((item) => {
          if (!Number.isInteger(item.productId) || item.productId <= 0)
            throw Object.assign(new Error('order item product id must be a positive integer'), { __placeFail: true, failedAt: 'items', reason: 'unknown' })
          if (!Number.isInteger(item.quantity) || item.quantity <= 0)
            throw Object.assign(new Error('order item quantity must be a positive integer'), { __placeFail: true, failedAt: 'items', reason: 'unknown' })
          if (!Number.isFinite(item.price) || item.price < 0)
            throw Object.assign(new Error('order item price must be a non-negative finite number'), { __placeFail: true, failedAt: 'items', reason: 'unknown' })
          return {
            order_id: orderId,
            product_id: item.productId,
            quantity: item.quantity,
            price: item.price,
            special_instructions: item.specialInstructions || null,
            created_at: now,
            updated_at: now,
          }
        })
        await trx.insertInto('order_items').values(values).execute()
        orderItemRows = await trx
          .selectFrom('order_items')
          .where('order_id', '=', orderId)
          .selectAll()
          .execute() as OrderItemJsonResponse[]
      }

      // 3. Insert the payment row if provided. The transaction_id
      // unique constraint catches duplicate Stripe webhook deliveries
      // (the pre-fix code's Co-19 backstop) — we surface it as a
      // structured result instead of a generic SQL error.
      let paymentRow: PaymentJsonResponse | undefined
      if (input.payment) {
        try {
          const paymentUuid = randomUUIDv7()
          await trx
            .insertInto('payments')
            .values({
              ...input.payment,
              order_id: orderId,
              uuid: paymentUuid,
              created_at: now,
              updated_at: now,
            } as NewPayment)
            .executeTakeFirst()
          paymentRow = await trx
            .selectFrom('payments')
            .where('uuid', '=', paymentUuid)
            .selectAll()
            .executeTakeFirst() as PaymentJsonResponse | undefined
          if (!paymentRow)
            throw Object.assign(new Error('payment insert could not be resolved by uuid'), { __placeFail: true, failedAt: 'payment', reason: 'unknown' })
        }
        catch (err: any) {
          if (isUniqueViolation(err))
            throw Object.assign(new Error('duplicate payment transaction_id'), { __placeFail: true, failedAt: 'payment', reason: 'duplicate-payment' })
          throw Object.assign(err, { __placeFail: true, failedAt: 'payment', reason: 'unknown' })
        }
      }

      // 4. Decrement inventory atomically. Same conditional UPDATE
      // shape as adjustInventoryMany — `inventory_count + delta >=
      // 0` enforces the precondition in the WHERE clause so two
      // concurrent placeOrders for the same last-in-stock item don't
      // both succeed.
      if (input.inventory && input.inventory.length > 0) {
        for (let i = 0; i < input.inventory.length; i++) {
          const { id, delta } = input.inventory[i]!
          if (!Number.isFinite(delta) || delta === 0)
            throw Object.assign(new Error('inventory delta must be a non-zero finite number'), { __placeFail: true, failedAt: 'inventory', reason: 'unknown' })

          const affected = await adjustInventoryOnConnection(trx, id, delta, now)
          if (!affected)
            throw Object.assign(new Error(`inventory adjust failed for product ${id}`), { __placeFail: true, failedAt: 'inventory', reason: 'out-of-stock' })
        }
      }

      // 5. Record the idempotency key inside the transaction so a
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
          if (isUniqueViolation(err))
            throw Object.assign(new Error('idempotency-key collision'), { __placeFail: true, failedAt: 'idempotency', reason: 'duplicate-idempotency-key' })
          // Missing table: degrade silently (the pre-transaction
          // lookup already warned).
          if (!isMissingTableError(err))
            throw err
        }
      }

      // 6. Refetch the order so callers get the post-write canonical row.
      const order = await trx.selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst() as OrderJsonResponse | undefined
      if (!order)
        throw Object.assign(new Error('order disappeared mid-transaction'), { __placeFail: true, failedAt: 'order', reason: 'unknown' })

      return { order, items: orderItemRows, payment: paymentRow }
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

    return { ok: true, order: result.order, items: result.items, payment: result.payment }
  }
  catch (err: any) {
    if (err?.__placeFail) {
      if (err.reason === 'duplicate-idempotency-key' && input.idempotencyKey) {
        const existing = await findOrderByIdempotencyKey(input.idempotencyKey)
        if (existing)
          return { ok: true, order: existing }
      }
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
