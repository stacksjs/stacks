import type { CategorizableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { slugify } from 'ts-slug'

type UpdateCategoryData = {
  id: number
  name?: string
  description?: string
  categorizable_id?: number
  categorizable_type?: string
  is_active?: boolean
  slug?: string
}

/**
 * Update a category
 *
 * @param data The category data to update
 * @returns The updated category record
 */
export async function update(data: UpdateCategoryData): Promise<CategorizableTable> {
  try {

    // Only include fields that are provided
    if (data.name !== undefined) {
      data.name = data.name
      data.slug = slugify(data.name)
    }

    const result = await db
      .updateTable('categorizable')
      .set(data)
      .where('id', '=', data.id)
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
