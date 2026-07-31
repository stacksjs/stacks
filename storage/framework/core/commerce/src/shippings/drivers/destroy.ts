import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { fetchById } from './fetch'

/**
 * Delete a driver by ID
 *
 * @param id The ID of the driver to delete
 * @returns True if the driver was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('drivers')
      .where('id', '=', id)
      .executeTakeFirst()

    return mutationCount(result) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete driver: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple drivers at once
 *
 * @param ids Array of driver IDs to delete
 * @returns Number of drivers deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  let deletedCount = 0

  try {
    // Process each driver deletion in a transaction
    await (db as any).transaction().execute(async (trx: any) => {
      for (const id of ids) {
        // Check if driver exists
        const driver = await fetchById(id)

        if (driver) {
          // Delete the driver
          await trx
            .deleteFrom('drivers')
            .where('id', '=', id)
            .execute()

          deletedCount++
        }
      }
    })

    return deletedCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete drivers in bulk: ${error.message}`)
    }

    throw error
  }
}
