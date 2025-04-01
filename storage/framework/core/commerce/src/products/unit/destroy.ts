import { db } from '@stacksjs/database'

/**
 * Delete a product unit by ID
 *
 * @param id The ID of the product unit to delete
 * @returns True if the product unit was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('product_units')
      .where('id', '=', id)
      .executeTakeFirst()

    // Return true if any row was affected (deleted)
    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete product unit: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple product units by ID
 *
 * @param ids Array of product unit IDs to delete
 * @returns Number of product units deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('product_units')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete product units: ${error.message}`)
    }

    throw error
  }
}
