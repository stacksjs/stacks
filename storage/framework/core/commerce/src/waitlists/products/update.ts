import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'
import { productWaitlistWriteData } from './write-data'
type WaitlistProductJsonResponse = ModelRow<typeof WaitlistProduct>
type WaitlistProductUpdate = UpdateModelData<typeof WaitlistProduct>

/**
 * Update a waitlist product
 *
 * @param id The id of the waitlist product to update
 * @param data The waitlist product data to update
 * @returns The updated waitlist product record
 */
export async function update(id: number, data: WaitlistProductUpdate): Promise<WaitlistProductJsonResponse> {
  try {
    if (!id)
      throw new Error('Waitlist product ID is required for update')

    const existing = await fetchById(id)
    if (!existing)
      throw new Error('Waitlist product not found')

    await db
      .updateTable('waitlist_products')
      .set({
        ...productWaitlistWriteData(
          data as Record<string, unknown>,
          existing as Record<string, unknown>,
        ),
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    const result = await fetchById(id)
    if (!result)
      throw new Error('Failed to update waitlist product')

    return result as WaitlistProductJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update waitlist product: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a waitlist product's status
 *
 * @param id The ID of the waitlist product
 * @param status The new status
 * @returns The updated waitlist product with the new status
 */
export async function updateStatus(
  id: number,
  status: 'waiting' | 'purchased' | 'notified' | 'cancelled',
): Promise<WaitlistProductJsonResponse> {
  return await update(id, { status } as WaitlistProductUpdate)
}

/**
 * Update party size for a waitlist product
 *
 * @param id The ID of the waitlist product
 * @param partySize The updated party size
 * @returns The updated waitlist product
 */
export async function updatePartySize(
  id: number,
  partySize: number,
): Promise<WaitlistProductJsonResponse> {
  return await update(id, { quantity: partySize } as WaitlistProductUpdate)
}
