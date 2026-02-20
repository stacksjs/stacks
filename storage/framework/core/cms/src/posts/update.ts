type PostJsonResponse = ModelRow<typeof Post>
type PostUpdate = UpdateModelData<typeof Post>
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
    if (data.title !== undefined && typeof data.title === 'string' && data.title.trim() === '') {
      throw new Error('Post title cannot be empty')
    }

    const validStatuses = ['published', 'draft', 'archived']
    if (data.status !== undefined && typeof data.status === 'string' && !validStatuses.includes(data.status)) {
      throw new Error(`Invalid post status: ${data.status}`)
    }

    if (data.views !== undefined && typeof data.views === 'number' && data.views < 0) {
      throw new Error('Views count cannot be negative')
    }

    const result = await db
      .updateTable('posts')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update post')

    return result as PostJsonResponse
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update post: ${error.message}`)

    throw error
  }
}
