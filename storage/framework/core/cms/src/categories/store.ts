import type { CategorizableTable } from '@stacksjs/orm'
import type { Request } from '@stacksjs/router'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

type CategorizableStore = Pick<CategorizableTable, 'name' | 'slug' | 'order' | 'description'>

/**
 * Create a new category
 *
 * @param request The category data to create
 * @returns The created category record
 */
export async function store(request: Request): Promise<CategorizableTable> {
  try {
    await request.validate()

    const categoryData: CategorizableStore = {
      name: request.get('name'),
      description: request.get('description'),
      order: request.get('order'),
      is_active: request.get<boolean>('is_active'),
      created_at: formatDate(new Date()),
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
