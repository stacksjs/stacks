import { db } from '@stacksjs/database'

/**
 * Delete a cart by ID
 *
 * @param id The ID of the cart to delete
 * @returns True if the cart was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('carts')
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete cart: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple carts by ID
 *
 * @param ids Array of cart IDs to delete
 * @returns Number of carts deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('carts')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete carts: ${error.message}`)
    }

    throw error
  }
}
