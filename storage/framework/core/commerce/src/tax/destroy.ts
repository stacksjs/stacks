import { db } from '@stacksjs/database'

/**
 * Delete a tax rate by ID
 *
 * @param id The ID of the tax rate to delete
 * @returns True if the tax rate was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('tax_rates')
      .where('id', '=', id)
      .executeTakeFirst()

    return Number(result.numDeletedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete tax rate: ${error.message}`)
    }

    throw error
  }
}

/**
 * Soft delete a tax rate by ID (updates status to 'inactive')
 *
 * @param id The ID of the tax rate to soft delete
 * @returns True if the tax rate was soft deleted, false otherwise
 */
export async function softDelete(id: number): Promise<boolean> {
  try {
    // Update the status to 'inactive' instead of deleting
    const result = await db
      .updateTable('tax_rates')
      .set({ status: 'inactive' })
      .where('id', '=', id)
      .executeTakeFirst()

    // Return true if any row was affected (updated)
    return Number(result.numUpdatedRows) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete tax rate: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple tax rates by ID
 *
 * @param ids Array of tax rate IDs to delete
 * @returns Number of tax rates deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('tax_rates')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return Number(result.numDeletedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete tax rates: ${error.message}`)
    }

    throw error
  }
}

/**
 * Soft delete multiple tax rates by ID (updates status to 'inactive')
 *
 * @param ids Array of tax rate IDs to soft delete
 * @returns Number of tax rates soft deleted
 */
export async function bulkSoftDelete(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Update the status to 'inactive' instead of deleting
    const result = await db
      .updateTable('tax_rates')
      .set({ status: 'inactive' })
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of updated rows
    return Number(result.numUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete tax rates: ${error.message}`)
    }

    throw error
  }
}
