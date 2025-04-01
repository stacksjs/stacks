import type { CategoryRequestType } from '@stacksjs/orm'
import type { CategoryJsonResponse, NewCategory } from '../../../../../orm/src/models/Category'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new category
 *
 * @param request The category data to store
 * @returns The newly created category record
 */
export async function store(request: CategoryRequestType): Promise<CategoryJsonResponse | undefined> {
  await request.validate()

  const categoryData: NewCategory = {
    name: request.get('name'),
    description: request.get('description'),
    image_url: request.get('image_url'),
    is_active: request.get<boolean>('is_active') ?? true,
    parent_category_id: request.get('parent_category_id'),
    display_order: request.get<number>('display_order') ?? 0,
  }

  categoryData.uuid = randomUUIDv7()

  try {
    // Insert the category record
    const createdCategory = await db
      .insertInto('categories')
      .values(categoryData)
      .executeTakeFirst()

    const insertId = Number(createdCategory.insertId) || Number(createdCategory.numInsertedOrUpdatedRows)

    // If insert was successful, retrieve the newly created category
    if (insertId) {
      const category = await db
        .selectFrom('categories')
        .where('id', '=', insertId)
        .selectAll()
        .executeTakeFirst()

      return category
    }

    return undefined
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('name')) {
        throw new Error('A category with this name already exists')
      }

      throw new Error(`Failed to create category: ${error.message}`)
    }

    throw error
  }
}
