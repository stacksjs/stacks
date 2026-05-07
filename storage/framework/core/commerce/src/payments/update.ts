import { db } from '@stacksjs/database'
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
