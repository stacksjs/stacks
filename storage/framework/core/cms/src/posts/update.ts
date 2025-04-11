import type { PostJsonResponse, PostRequestType, PostUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a post by ID
 *
 * @param id The ID of the post to update
 * @param request The updated post data
 * @returns The updated post record
 */
export async function update(id: number, request: PostRequestType): Promise<PostJsonResponse | undefined> {
  try {
    await request.validate()
    // Create a single update data object directly from the request
    const updateData: PostUpdate = {
      title: request.get('title'),
      author: request.get('author'),
      category: request.get('category'),
      poster: request.get('poster'),
      body: request.get('body'),
      views: request.get<number>('views'),
      comments: request.get<number>('comments'),
      published_at: request.get<number>('publishedAt'),
      status: request.get('status'),
      updated_at: formatDate(new Date()),
    }

    if (Object.keys(updateData).length === 0) {
      return await db
        .selectFrom('posts')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()
    }

    // Update the post record
    await db
      .updateTable('posts')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    const updatedPost = await db
      .selectFrom('posts')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return updatedPost
  }
  catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      // Re-throw the error with a more user-friendly message
      throw new TypeError(`Failed to update post: ${error.message}`)
    }

    throw error
  }
}
