import { db } from '@stacksjs/database'

/**
 * Delete a shipping method by ID
 *
 * @param id The ID of the shipping method to delete
 * @returns True if the shipping method was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('shipping_methods')
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete shipping method: ${error.message}`)
    }

    throw error
  }
}

/**
 * Soft delete a shipping method by ID (updates status to 'inactive')
 *
 * @param id The ID of the shipping method to soft delete
 * @returns True if the shipping method was soft deleted, false otherwise
 */
export async function softDelete(id: number): Promise<boolean> {
  try {
    // Update the status to 'inactive' instead of deleting
    const result = await db
      .updateTable('shipping_methods')
      .set({ status: 'inactive' })
      .where('id', '=', id)
      .executeTakeFirst()

    // Return true if any row was affected (updated)
    return Number(result.numUpdatedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete shipping method: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple shipping methods by ID
 *
 * @param ids Array of shipping method IDs to delete
 * @returns Number of shipping methods deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('shipping_methods')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete shipping methods: ${error.message}`)
    }

    throw error
  }
}

/**
 * Soft delete multiple shipping methods by ID (updates status to 'inactive')
 *
 * @param ids Array of shipping method IDs to soft delete
 * @returns Number of shipping methods soft deleted
 */
export async function bulkSoftDelete(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Update the status to 'inactive' instead of deleting
    const result = await db
      .updateTable('shipping_methods')
      .set({ status: 'inactive' })
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of updated rows
    return Number(result.numUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete shipping methods: ${error.message}`)
    }

    throw error
  }
}
