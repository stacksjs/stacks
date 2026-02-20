import type { CategorizableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

interface UpdateCategoryData {
  id: number
  name?: string
  description?: string
  categorizable_type?: string
  is_active?: boolean
  slug?: string
}

/**
 * Update a category
 *
 * @param data The category data to update (must include id)
 * @returns The updated category record
 */
export async function update(data: UpdateCategoryData): Promise<CategorizableTable> {
  try {
    const id = data.id

    if (!id) {
      throw new Error('Category ID is required for update')
    }

    if (data.name !== undefined) {
      if (data.name.trim() === '') {
        throw new Error('Category name cannot be empty')
      }
      data.slug = slugify(data.name)
    }

    // Remove id from the data to avoid updating it
    const { id: _id, ...updateData } = data

    const result = await db
      .updateTable('categorizables')
      .set(updateData as unknown as Record<string, unknown>)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update category')

    return result as unknown as CategorizableTable
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update category: ${error.message}`)

    throw error
  }
}
