import { db } from '@stacksjs/database'

function mutationCount(result: unknown): number {
  if (typeof result === 'number')
    return Number.isFinite(result) ? result : 0
  if (typeof result === 'bigint')
    return Number(result)
  if (!result || typeof result !== 'object')
    return 0

  const record = result as Record<string, unknown>
  for (const key of ['changes', 'affectedRows', 'count', 'numAffectedRows', 'numDeletedRows']) {
    if (record[key] !== undefined && record[key] !== null)
      return mutationCount(record[key])
  }
  if (Array.isArray(result))
    return result.reduce((total, item) => total + mutationCount(item), 0)
  return 0
}

/**
 * Delete a print log by ID
 *
 * @param id The ID of the print log to delete
 * @returns True if the print log was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('receipts')
      .where('id', '=', id)
      .executeTakeFirst()

    return mutationCount(result) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete print log: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple print logs by ID
 *
 * @param ids Array of print log IDs to delete
 * @returns Number of print logs deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Perform the delete operation
    const result = await db
      .deleteFrom('receipts')
      .where('id', 'in', ids)
      .executeTakeFirst()

    // Return the number of deleted rows
    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete receipts: ${error.message}`)
    }

    throw error
  }
}
