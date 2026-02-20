import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
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

    const d = data as Record<string, unknown>
    const result = await db
      .updateTable('waitlist_products')
      .set({
        name: data.name,
        email: data.email,
        phone: data.phone,
        quantity: data.quantity ?? d.party_size,
        notification_preference: d.notification_preference,
        source: data.source,
        notes: data.notes,
        status: data.status,
        product_id: data.product_id,
        customer_id: data.customer_id,
        notified_at: d.notified_at,
        purchased_at: d.purchased_at,
        cancelled_at: d.cancelled_at,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

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
  try {
    const result = await db
      .updateTable('waitlist_products')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update waitlist product status')

    return result as WaitlistProductJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update waitlist product status: ${error.message}`)
    }

    throw error
  }
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
  try {
    const result = await db
      .updateTable('waitlist_products')
      .set({
        quantity: partySize,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update party size')

    return result as WaitlistProductJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update party size: ${error.message}`)
    }

    throw error
  }
}
