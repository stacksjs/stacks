import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Delete a post by ID
 *
 * @param id The ID of the post to delete
 * @returns True if the deletion was successful, false otherwise
 */
export async function destroy(id: number): Promise<boolean> {
  try {
    // First check if the post exists
    const post = await fetchById(id)

    if (!post) {
      throw new Error(`Post with ID ${id} not found`)
    }

    // Delete the post
    const result = await db
      .deleteFrom('posts')
      .where('id', '=', id)
      .executeTakeFirst()

    return result.numDeletedRows > 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete post: ${error.message}`)
    }

    throw error
  }
}

/**
 * Bulk delete multiple posts
 *
 * @param ids Array of post IDs to delete
 * @returns Number of posts successfully deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length)
    return 0

  try {
    // Delete all posts in the array
    const result = await db
      .deleteFrom('posts')
      .where('id', 'in', ids)
      .executeTakeFirst()

    return Number(result.numDeletedRows) || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete posts in bulk: ${error.message}`)
    }

    throw error
  }
}
