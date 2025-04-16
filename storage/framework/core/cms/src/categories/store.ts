import type { CategorizableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { slugify } from 'ts-slug'

interface CategoryData {
  name: string
  description?: string
  categorizable_id: number
  categorizable_type: string
  is_active?: boolean
}

/**
 * Create a new category
 *
 * @param data The category data to create
 * @returns The created category record
 */
export async function store(data: CategoryData): Promise<CategorizableTable> {
  try {
    const categoryData = {
      name: data.name,
      slug: slugify(data.name),
      description: data.description,
      categorizable_id: data.categorizable_id,
      categorizable_type: data.categorizable_type,
      is_active: data.is_active ?? true,
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
