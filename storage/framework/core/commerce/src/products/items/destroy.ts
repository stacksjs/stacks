import { db } from '@stacksjs/database'

/**
 * Delete a product item by ID
 *
 * @param id The ID of the product item to delete
 * @returns True if the product item was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('products')
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete product item: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple product items by ID
 *
 * @param ids Array of product item IDs to delete
 * @returns Number of product items deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('products')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete product items: ${error.message}`)
    }

    throw error
  }
}
