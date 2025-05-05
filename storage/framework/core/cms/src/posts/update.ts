import type { PostJsonResponse, PostUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a post
 *
 * @param id The id of the post to update
 * @param data The post data to update
 * @returns The updated post record
 */
export async function update(id: number, data: Partial<PostUpdate>): Promise<PostJsonResponse> {
  try {

    const result = await db
      .updateTable('posts')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update post')

    // // Handle tags if they exist in the data
    // if (data.tags && Array.isArray(data.tags)) {
    //   // First, delete existing tags for this post
    //   await db
    //     .deleteFrom('taggable')
    //     .where('taggable_id', '=', id)
    //     .where('taggable_type', '=', 'posts')
    //     .execute()

    //   // Then add the new tags
    //   for (const tag of data.tags) {
    //     await storeTag({
    //       name: tag,
    //       taggable_id: id,
    //       taggable_type: 'posts',
    //       is_active: true,
    //     })
    //   }
    // }

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update post: ${error.message}`)

    throw error
  }
}
