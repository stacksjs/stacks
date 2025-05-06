import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Delete a category by ID
 *
 * @param id The ID of the category to delete
 * @returns True if the deletion was successful, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    // First check if the category exists
    const category = await fetchById(id)

    if (!category) {
      throw new Error(`Category with ID ${id} not found`)
    }

    // Delete the category
    const result = await db
      .deleteFrom('categorizables')
      .where('id', '=', id)
      .executeTakeFirst()

    return result.numDeletedRows > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete category: ${error.message}`)
    }

    throw error
  }
}

/**
 * Bulk delete multiple categories
 *
 * @param ids Array of category IDs to delete
 * @returns Number of categories successfully deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Delete all categories in the array
    const result = await db
      .deleteFrom('categorizables')
      .where('id', 'in', ids)
      .executeTakeFirst()

    return Number(result.numDeletedRows) || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete categories in bulk: ${error.message}`)
    }

    throw error
  }
}
