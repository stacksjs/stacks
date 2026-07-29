import { db, sqlHelpers } from '@stacksjs/database'
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
  if (!existing) {
    throw new Error(`Payment with ID ${id} not found`)
  }

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
 */
export async function recordRefund(id: number, amount: number): Promise<PaymentJsonResponse> {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new TypeError('Payment ID must be a positive integer')
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new TypeError('Refund amount must be a positive integer in minor units')

  const dialect = sqlHelpers(env.DB_CONNECTION || 'sqlite')
  const p = dialect.param
  const now = formatDate(new Date())
  const statement = await (db as any).unsafe(
    `UPDATE payments
    SET refund_amount = COALESCE(refund_amount, 0) + ${p(1)},
        status = CASE WHEN COALESCE(refund_amount, 0) + ${p(2)} = amount
          THEN 'refunded' ELSE 'partiallyRefunded' END,
        updated_at = ${p(3)}
    WHERE id = ${p(4)}
      AND status IN ('completed', 'succeeded', 'partiallyRefunded')
      AND COALESCE(refund_amount, 0) + ${p(5)} <= amount`,
    [amount, amount, now, id, amount],
  )
  const result: any = typeof statement?.execute === 'function' ? await statement.execute() : statement

  const affected = Number(
    result?.numUpdatedRows
    ?? result?.[0]?.numUpdatedRows
    ?? result?.numAffectedRows
    ?? result?.affectedRows
    ?? result?.[0]?.affectedRows
    ?? result?.changes
    ?? 0,
  )
  if (affected > 0) {
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

  const remainingAmount = Number(payment.amount || 0) - Number(payment.refund_amount || 0)
  throw new Error(`Refund amount exceeds the remaining ${remainingAmount} minor units`)
}
