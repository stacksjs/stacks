import type { PostJsonResponse, PostUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

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

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update post: ${error.message}`)

    throw error
  }
}
