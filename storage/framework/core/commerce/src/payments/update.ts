import type { ModelRow, Payment, UpdateModelData } from '@stacksjs/orm'
import { db, mutationCount, sqlHelpers } from '@stacksjs/database'
import { env } from '@stacksjs/env'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

type PaymentJsonResponse = ModelRow<typeof Payment>
type PaymentUpdate = UpdateModelData<typeof Payment>

/**
 * Update a payment by ID.
 *
 * Supports the lifecycle a payment row goes through after creation —
 * status transitions (pending → completed/failed/refunded), refund
 * amount tracking, processor metadata (transaction ID, card brand),
 * and operator notes. The original `amount` is intentionally fillable
 * via this path because partial captures and adjustments can rewrite
 * it before settlement; if your processor never adjusts captured
 * amounts, just don't pass `amount` in `data`.
 *
 * @param id The ID of the payment to update
 * @param data The updated payment data (omit `id`)
 * @returns The updated payment record
 */
export async function update(id: number, data: Omit<PaymentUpdate, 'id'>): Promise<PaymentJsonResponse | undefined> {
  const existing = await fetchById(id)
  if (!existing)
    return undefined

  try {
    await db
      .updateTable('payments')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      // Same uniqueness collision the store path can hit — surface it
      // with the same wording so callers can pattern-match.
      if (error.message.includes('Duplicate entry') && error.message.includes('transaction_id')) {
        throw new Error('A payment with this transaction ID already exists')
      }
      throw new Error(`Failed to update payment: ${error.message}`)
    }
    throw error
  }
}

const REFUNDABLE_STATUSES = new Set(['completed', 'succeeded', 'partiallyRefunded'])

/**
 * Record a processor-confirmed refund against a payment.
 *
 * Amounts are integer minor units. A single conditional update performs the
 * increment and remaining-balance check atomically, so concurrent operators
 * cannot record more than the captured amount.
 *
 * `status` is assigned before `refund_amount` because MySQL evaluates SET
 * assignments left to right against values already updated, so a CASE placed
 * after the increment recorded a full refund as `partiallyRefunded`. Its never-
 * taken `WHEN 1 = 0 THEN status` branch types the CASE as the column: a CASE of
 * bare literals is text, which PostgreSQL will not assign to the enum type
 * `status` has there.
 */
export async function recordRefund(id: number, amount: number): Promise<PaymentJsonResponse> {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new TypeError('Payment ID must be a positive integer')
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new TypeError('Refund amount must be a positive integer in minor units')

  const dialect = sqlHelpers(env.DB_CONNECTION || 'sqlite')
  const p = dialect.param
  const now = formatDate(new Date())
  const statement = await db.unsafe(
    `UPDATE payments
    SET status = CASE WHEN COALESCE(refund_amount, 0) + ${p(1)} = amount THEN 'refunded'
          WHEN 1 = 0 THEN status ELSE 'partiallyRefunded' END,
        refund_amount = COALESCE(refund_amount, 0) + ${p(2)},
        updated_at = ${p(3)}
    WHERE id = ${p(4)}
      AND status IN ('completed', 'succeeded', 'partiallyRefunded')
      AND COALESCE(refund_amount, 0) + ${p(5)} <= amount`,
    [amount, amount, now, id, amount],
  )
  // A write resolves to the driver's result, not the rows `db.unsafe` is
  // declared to return. PostgreSQL carries the count in `count`, which the
  // reader here used to miss, so a committed refund was diagnosed as a failure.
  if (mutationCount(statement) > 0) {
    const updated = await fetchById(id)
    if (updated)
      return updated
    throw new Error(`Payment with ID ${id} disappeared during refund`)
  }

  const payment = await fetchById(id)
  if (!payment)
    throw new Error(`Payment with ID ${id} not found`)

  const status = String(payment.status || '')
  if (!REFUNDABLE_STATUSES.has(status))
    throw new Error(`Payment status ${status || 'unknown'} cannot be refunded`)

  const persisted = payment as PaymentJsonResponse & { refund_amount?: unknown }
  const remainingAmount = Number(payment.amount || 0) - Number(persisted.refundAmount ?? persisted.refund_amount ?? 0)
  throw new Error(`Refund amount exceeds the remaining ${remainingAmount} minor units`)
}
