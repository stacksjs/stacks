import type { WaitlistProductJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Delete a waitlist product entry by ID
 *
 * @param id The ID of the waitlist product to delete
 * @returns The deleted waitlist product record
 */
export async function destroy(id: number): Promise<WaitlistProductJsonResponse | undefined> {
  try {
    // First get the waitlist product to return it after deletion
    const waitlistProduct = await db
      .selectFrom('waitlist_products')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!waitlistProduct)
      return undefined

    // Delete the waitlist product
    await db
      .deleteFrom('waitlist_products')
      .where('id', '=', id)
      .execute()

    return waitlistProduct
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete waitlist product: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple waitlist product entries by their IDs
 *
 * @param ids Array of waitlist product IDs to delete
 * @returns Number of waitlist products deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Delete all waitlist products with the given IDs
    const result = await db
      .deleteFrom('waitlist_products')
      .where('id', 'in', ids)
      .execute()

    return result.length || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete waitlist products in bulk: ${error.message}`)
    }

    throw error
  }
}
