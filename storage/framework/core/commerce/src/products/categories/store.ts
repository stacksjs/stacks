import type { CategoryJsonResponse, NewCategory } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new category
 *
 * @param data The category data to store
 * @returns The newly created category record
 */
export async function store(data: NewCategory): Promise<CategoryJsonResponse> {
  try {
    const categoryData = {
      ...data,
      uuid: randomUUIDv7(),
      is_active: data.is_active ?? true,
      display_order: data.display_order ?? 0,
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
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('name')) {
        throw new Error('A category with this name already exists')
      }

      throw new Error(`Failed to create category: ${error.message}`)
    }

    throw error
  }
}
