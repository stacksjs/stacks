import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { fetchById } from './fetch'

/**
 * Delete a courier by ID
 *
 * @param id The ID of the courier to delete
 * @returns True if the courier was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('couriers')
      .where('id', '=', id)
      .executeTakeFirst()

    return mutationCount(result) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete courier: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple couriers at once
 *
 * @param ids Array of courier IDs to delete
 * @returns Number of couriers deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  let deletedCount = 0

  try {
    // Process each courier deletion in a transaction
    await db.transaction(async (trx) => {
      for (const id of ids) {
        // Check if courier exists
        const courier = await fetchById(id)

        if (courier) {
          // Delete the courier
          await trx
            .deleteFrom('couriers')
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
      throw new TypeError(`Failed to delete couriers in bulk: ${error.message}`)
    }

    throw error
  }
}
