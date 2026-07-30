import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'

/**
 * Delete a review by ID
 *
 * @param id The ID of the review to delete
 * @returns True if the review was deleted, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    const result = await db
      .deleteFrom('reviews')
      .where('id', '=', id)
      .executeTakeFirst()

    return mutationCount(result) > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete review: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple reviews by ID
 *
 * @param ids Array of review IDs to delete
 * @returns Number of reviews deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    const result = await db
      .deleteFrom('reviews')
      .where('id', 'in', ids)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete reviews: ${error.message}`)
    }

    throw error
  }
}
