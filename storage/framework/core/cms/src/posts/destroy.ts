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

    // Delete related categorizable_models entries first
    await db
      .deleteFrom('categorizable_models')
      .where('categorizable_id', '=', id)
      .where('categorizable_type', '=', 'posts')
      .execute()

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
    // First verify which posts actually exist
    const existingPosts = await db
      .selectFrom('posts')
      .select('id')
      .where('id', 'in', ids)
      .execute()

    const existingIds = existingPosts.map(post => post.id)

    if (!existingIds.length)
      return 0

    // Delete related categorizable_models entries first
    await db
      .deleteFrom('categorizable_models')
      .where('categorizable_id', 'in', existingIds)
      .where('categorizable_type', '=', 'posts')
      .execute()

    // Delete all existing posts
    const result = await db
      .deleteFrom('posts')
      .where('id', 'in', existingIds)
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
