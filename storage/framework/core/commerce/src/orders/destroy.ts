import { db } from '@stacksjs/database'

/**
 * Delete an order by ID
 *
 * @param id The ID of the order to delete
 * @returns True if the order was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('orders')
      .where('id', '=', id)
      .executeTakeFirst()

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
 * Soft delete an order by ID (updates status to CANCELED)
 *
 * @param id The ID of the order to soft delete
 * @returns True if the order was soft deleted, false otherwise
 */
export async function softDelete(id: number): Promise<boolean> {
  try {
    // Update the status to CANCELED instead of deleting
    const result = await db
      .updateTable('orders')
      .set({ status: 'CANCELED' })
      .where('id', '=', id)
      .executeTakeFirst()

    // Return true if any row was affected (updated)
    return Number(result.numUpdatedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete order: ${error.message}`)
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
      .deleteFrom('orders')
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

/**
 * Soft delete multiple orders by ID (updates status to CANCELED)
 *
 * @param ids Array of order IDs to soft delete
 * @returns Number of orders soft deleted
 */
export async function bulkSoftDelete(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Update the status to CANCELED instead of deleting
    const result = await db
      .updateTable('orders')
      .set({ status: 'CANCELED' })
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of updated rows
    return Number(result.numUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete orders: ${error.message}`)
    }

    throw error
  }
}
