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
 * Soft delete a delivery route by ID (marks as inactive)
 *
 * @param id The ID of the delivery route to soft delete
 * @returns True if the delivery route was soft deleted, false otherwise
 */
export async function softDelete(id: number): Promise<boolean> {
  try {
    // Update the status to inactive instead of deleting
    const result = await db
      .updateTable('delivery_routes')
      .set({
        last_active: undefined,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .executeTakeFirst()

    // Return true if any row was affected (updated)
    return Number(result.numUpdatedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete delivery route: ${error.message}`)
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

/**
 * Soft delete multiple delivery routes by ID (marks as inactive)
 *
 * @param ids Array of delivery route IDs to soft delete
 * @returns Number of delivery routes soft deleted
 */
export async function bulkSoftDelete(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Update the status to inactive instead of deleting
    const result = await db
      .updateTable('delivery_routes')
      .set({
        last_active: undefined,
        updated_at: new Date().toISOString(),
      })
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of updated rows
    return Number(result.numUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete delivery routes: ${error.message}`)
    }

    throw error
  }
}
