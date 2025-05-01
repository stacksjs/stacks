import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Delete a page by ID
 *
 * @param id The ID of the page to delete
 * @returns True if the deletion was successful, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    // First check if the page exists
    const page = await fetchById(id)

    if (!page) {
      throw new Error(`Page with ID ${id} not found`)
    }

    // Delete the page
    const result = await db
      .deleteFrom('pages')
      .where('id', '=', id)
      .executeTakeFirst()

    return result.numDeletedRows > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete page: ${error.message}`)
    }

    throw error
  }
}

/**
 * Bulk delete multiple pages
 *
 * @param ids Array of page IDs to delete
 * @returns Number of pages successfully deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Delete all pages in the array
    const result = await db
      .deleteFrom('pages')
      .where('id', 'in', ids)
      .executeTakeFirst()

    return Number(result.numDeletedRows) || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete pages in bulk: ${error.message}`)
    }

    throw error
  }
}
