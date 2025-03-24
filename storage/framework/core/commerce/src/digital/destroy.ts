import { db } from '@stacksjs/database'

/**
 * Delete a digital delivery by ID
 *
 * @param id The ID of the digital delivery to delete
 * @returns True if the digital delivery was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('digital_deliveries')
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete digital delivery: ${error.message}`)
    }

    throw error
  }
}

/**
 * Soft delete a digital delivery by ID (updates status to 'inactive')
 *
 * @param id The ID of the digital delivery to soft delete
 * @returns True if the digital delivery was soft deleted, false otherwise
 */
export async function softDelete(id: number): Promise<boolean> {
  try {
    // Update the status to 'inactive' instead of deleting
    const result = await db
      .updateTable('digital_deliveries')
      .set({ status: 'inactive' })
      .where('id', '=', id)
      .executeTakeFirst()

    // Return true if any row was affected (updated)
    return Number(result.numUpdatedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete digital delivery: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple digital deliveries by ID
 *
 * @param ids Array of digital delivery IDs to delete
 * @returns Number of digital deliveries deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('digital_deliveries')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete digital deliveries: ${error.message}`)
    }

    throw error
  }
}

/**
 * Soft delete multiple digital deliveries by ID (updates status to 'inactive')
 *
 * @param ids Array of digital delivery IDs to soft delete
 * @returns Number of digital deliveries soft deleted
 */
export async function bulkSoftDelete(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Update the status to 'inactive' instead of deleting
    const result = await db
      .updateTable('digital_deliveries')
      .set({ status: 'inactive' })
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of updated rows
    return Number(result.numUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete digital deliveries: ${error.message}`)
    }

    throw error
  }
}
