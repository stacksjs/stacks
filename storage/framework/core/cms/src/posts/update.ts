import type { PostJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { store as storeTag } from '../tags/store'

type UpdatePostData = {
  id: number
  user_id?: number
  title?: string
  author?: string
  category?: string
  poster?: string
  body?: string
  views?: number
  publishedAt?: number
  status?: string
  tags?: string[]
}

/**
 * Update a post
 *
 * @param data The post data to update
 * @returns The updated post record
 */
export async function update(data: UpdatePostData): Promise<PostJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    const result = await db
      .updateTable('posts')
      .set(updateData)
      .where('id', '=', data.id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update post')

    // Handle tags if they exist in the data
    if (data.tags && Array.isArray(data.tags)) {
      // First, delete existing tags for this post
      await db
        .deleteFrom('taggable')
        .where('taggable_id', '=', data.id)
        .where('taggable_type', '=', 'posts')
        .execute()

      // Then add the new tags
      for (const tag of data.tags) {
        await storeTag({
          name: tag,
          taggable_id: data.id,
          taggable_type: 'posts',
          is_active: true,
        })
      }
    }

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update post: ${error.message}`)

    throw error
  }
}
