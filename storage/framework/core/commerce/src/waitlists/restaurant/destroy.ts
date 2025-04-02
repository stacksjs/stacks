import type { WaitlistRestaurantJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Delete a restaurant waitlist entry by ID
 *
 * @param id The ID of the restaurant waitlist entry to delete
 * @returns The deleted restaurant waitlist record
 */
export async function destroy(id: number): Promise<WaitlistRestaurantJsonResponse | undefined> {
  try {
    // First get the restaurant waitlist entry to return it after deletion
    const waitlistEntry = await db
      .selectFrom('waitlist_restaurants')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!waitlistEntry)
      return undefined

    // Delete the restaurant waitlist entry
    await db
      .deleteFrom('waitlist_restaurants')
      .where('id', '=', id)
      .execute()

    return waitlistEntry
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete restaurant waitlist entry: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple restaurant waitlist entries by their IDs
 *
 * @param ids Array of restaurant waitlist entry IDs to delete
 * @returns Number of restaurant waitlist entries deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Delete all restaurant waitlist entries with the given IDs
    const result = await db
      .deleteFrom('waitlist_restaurants')
      .where('id', 'in', ids)
      .execute()

    return result.length || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete restaurant waitlist entries in bulk: ${error.message}`)
    }

    throw error
  }
}
