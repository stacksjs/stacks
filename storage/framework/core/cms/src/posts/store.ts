import type { NewPost, PostJsonResponse, PostRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Create a new post
 *
 * @param request The post data to create
 * @returns The created post record
 */
export async function store(request: PostRequestType): Promise<PostJsonResponse> {
  try {
    await request.validate()

    const postData: NewPost = {
      user_id: request.get<number>('user_id'),
      title: request.get('title'),
      author: request.get('author'),
      category: request.get('category'),
      poster: request.get('poster'),
      body: request.get('body'),
      views: request.get<number>('views') || 0,
      published_at: request.get<number>('publishedAt'),
      status: request.get('status') || 'draft',
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    }

    const result = await db
      .insertInto('posts')
      .values(postData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create post')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create post: ${error.message}`)

    throw error
  }
}
