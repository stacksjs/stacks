import { db } from '@stacksjs/database'
import { fetchCommentById } from './fetch'

/**
 * Delete a comment by ID
 *
 * @param id The ID of the comment to delete
 * @returns True if the deletion was successful, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    // First check if the comment exists
    const comment = await fetchCommentById(id)

    if (!comment) {
      throw new Error(`Comment with ID ${id} not found`)
    }

    // Delete the comment
    const result = await db
      .deleteFrom('commentables')
      .where('id', '=', id)
      .executeTakeFirst()

    return result.numDeletedRows > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete comment: ${error.message}`)
    }

    throw error
  }
}

/**
 * Bulk delete multiple comments
 *
 * @param ids Array of comment IDs to delete
 * @returns Number of comments successfully deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Delete all comments in the array
    const result = await db
      .deleteFrom('commentables')
      .where('id', 'in', ids)
      .executeTakeFirst()

    return Number(result.numDeletedRows) || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete comments in bulk: ${error.message}`)
    }

    throw error
  }
}
