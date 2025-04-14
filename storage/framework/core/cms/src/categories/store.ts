import type { CategorizableTable, CategoryRequestType } from '@stacksjs/orm'
import type { Request } from '@stacksjs/router'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { slugify } from 'ts-slug'

type CategorizableStore = Omit<CategorizableTable, 'updated_at'>

/**
 * Create a new category
 *
 * @param request The category data to create
 * @returns The created category record
 */
export async function store(request: CategoryRequestType): Promise<CategorizableTable> {
  try {
    await request.validate()

    const categoryData: CategorizableStore = {
      name: request.get('name'),
      slug: slugify(request.get('name')),
      description: request.get('description'),
      categorizable_id: request.get('categorizable_id'),
      categorizable_type: request.get('categorizable_type'),
      is_active: request.get<boolean>('is_active'),
      created_at: formatDate(new Date()),
    }

    const result = await db
      .insertInto('categorizable')
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
