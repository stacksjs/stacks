import type { CategorizableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

interface UpdateCategoryData {
  name?: string
  description?: string
  categorizable_type?: string
  is_active?: boolean
  slug?: string
}

/**
 * Update a category
 *
 * @param id The category id to update
 * @param data The category data to update
 * @returns The updated category record
 */
export async function update(id: number, data: UpdateCategoryData): Promise<CategorizableTable> {
  try {
    if (data.name !== undefined) {
      data.slug = slugify(data.name)
    }

    const result = await db
      .updateTable('categorizables')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update category')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update category: ${error.message}`)

    throw error
  }
}
