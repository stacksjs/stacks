import { db } from '@stacksjs/database'

/**
 * Delete a product variant by ID
 *
 * @param id The ID of the product variant to delete
 * @returns True if the product variant was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('product_variants')
      .where('id', '=', id)
      .executeTakeFirst()

    // Return true if any row was affected (deleted)
    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete product variant: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple product variants by ID
 *
 * @param ids Array of product variant IDs to delete
 * @returns Number of product variants deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('product_variants')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete product variants: ${error.message}`)
    }

    throw error
  }
}
