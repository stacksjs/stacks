import type { NewPostCategory, PostCategoryJsonResponse, PostCategoryRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Create a new category
 *
 * @param request The category data to create
 * @returns The created category record
 */
export async function store(request: PostCategoryRequestType): Promise<PostCategoryJsonResponse> {
  try {
    await request.validate()

    const categoryData: NewPostCategory = {
      name: request.get('name'),
      description: request.get('description'),
      slug: request.get('slug'),
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    }

    const result = await db
      .insertInto('categories')
      .values(categoryData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create category')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create category: ${error.message}`)

    throw error
  }
}
