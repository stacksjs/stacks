import { db } from '@stacksjs/database'

/**
 * Delete an order by ID
 *
 * @param id The ID of the order to delete
 * @returns True if the order was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('reviews')
      .where('id', '=', id)
      .executeTakeFirst()

    // Return true if any row was affected (deleted)
    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete order: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple orders by ID
 *
 * @param ids Array of order IDs to delete
 * @returns Number of orders deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('reviews')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete orders: ${error.message}`)
    }

    throw error
  }
}
