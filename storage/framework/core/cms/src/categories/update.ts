import type { PostCategoryJsonResponse, PostCategoryRequestType, PostCategoryUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a category by ID
 *
 * @param id The ID of the category to update
 * @param request The updated category data
 * @returns The updated category record
 */
export async function update(id: number, request: PostCategoryRequestType): Promise<PostCategoryJsonResponse | undefined> {
  try {
    await request.validate()
    // Create a single update data object directly from the request
    const updateData: PostCategoryUpdate = {
      name: request.get('name'),
      description: request.get('description'),
      slug: request.get('slug'),
      updated_at: formatDate(new Date()),
    }

    if (Object.keys(updateData).length === 0) {
      return await db
        .selectFrom('post_categories')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()
    }

    // Update the category record
    await db
      .updateTable('post_categories')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    const updatedCategory = await db
      .selectFrom('post_categories')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return updatedCategory
  }
  catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      // Re-throw the error with a more user-friendly message
      throw new TypeError(`Failed to update category: ${error.message}`)
    }

    throw error
  }
}
