import { db } from '@stacksjs/database'

/**
 * Delete a delivery route by ID
 *
 * @param id The ID of the delivery route to delete
 * @returns True if the delivery route was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('delivery_routes')
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete delivery route: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple delivery routes by ID
 *
 * @param ids Array of delivery route IDs to delete
 * @returns Number of delivery routes deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('delivery_routes')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete delivery routes: ${error.message}`)
    }

    throw error
  }
}
