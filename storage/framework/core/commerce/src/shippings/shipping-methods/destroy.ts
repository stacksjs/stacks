import { db, matchedRows } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'

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

    return mutationCount(result) > 0
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
    // Update the status to 'inactive' instead of deleting. MySQL counts rows
    // CHANGED, so a method already inactive reports 0 there; matchedRows asks what
    // the predicate matched instead (stacksjs/stacks#2639).
    const matched = await matchedRows(db
      .updateTable('shipping_methods')
      .set({ status: 'inactive' })
      .where('id', '=', id))

    return matched.length > 0
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
    return mutationCount(result)
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
    // Same as softDelete: on MySQL the rows already holding 'inactive'
    // would otherwise be left out of the count (stacksjs/stacks#2639).
    const matched = await matchedRows(db
      .updateTable('shipping_methods')
      .set({ status: 'inactive' })
      .where('id', 'in', ids))

    return matched.length
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to soft delete shipping methods: ${error.message}`)
    }

    throw error
  }
}
