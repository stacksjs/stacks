import { db, matchedRows } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'

/**
 * Delete a license key by ID
 *
 * @param id The ID of the license key to delete
 * @returns True if the license key was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('license_keys')
      .where('id', '=', id)
      .executeTakeFirst()

    return mutationCount(result) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete license key: ${error.message}`)
    }

    throw error
  }
}

/**
 * Soft delete a license key by ID (updates status to 'inactive')
 *
 * @param id The ID of the license key to soft delete
 * @returns True if the license key was soft deleted, false otherwise
 */
export async function softDelete(id: number): Promise<boolean> {
  try {
    // Update the status to 'inactive' instead of deleting. MySQL counts rows
    // CHANGED, so a key already inactive reports 0 there; matchedRows asks what
    // the predicate matched instead (stacksjs/stacks#2639).
    const matched = await matchedRows(db
      .updateTable('license_keys')
      .set({ status: 'inactive' })
      .where('id', '=', id))

    return matched.length > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete license key: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple license keys by ID
 *
 * @param ids Array of license key IDs to delete
 * @returns Number of license keys deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('license_keys')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete license keys: ${error.message}`)
    }

    throw error
  }
}

/**
 * Soft delete multiple license keys by ID (updates status to 'inactive')
 *
 * @param ids Array of license key IDs to soft delete
 * @returns Number of license keys soft deleted
 */
export async function bulkSoftDelete(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Same as softDelete: on MySQL the rows already holding 'inactive'
    // would otherwise be left out of the count (stacksjs/stacks#2639).
    const matched = await matchedRows(db
      .updateTable('license_keys')
      .set({ status: 'inactive' })
      .where('id', 'in', ids))

    return matched.length
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete license keys: ${error.message}`)
    }

    throw error
  }
}
