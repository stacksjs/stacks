import { db } from '@stacksjs/database'

/**
 * Delete a print device by ID
 *
 * @param id The ID of the print device to delete
 * @returns True if the print device was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('print_devices')
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete print device: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple print devices by ID
 *
 * @param ids Array of print device IDs to delete
 * @returns Number of print devices deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('print_devices')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete print devices: ${error.message}`)
    }

    throw error
  }
}
