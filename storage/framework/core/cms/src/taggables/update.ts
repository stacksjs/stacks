import type { TaggableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { uniqueSlug } from '@stacksjs/slug'

interface UpdateTagData {
  id: number
  name?: string
  slug?: string
  description?: string
  is_active?: boolean
  taggable_id?: number
  taggable_type?: string
}

/**
 * Update a tag
 *
 * @param id The tag id
 * @param data The tag data to update
 * @returns The updated tag record
 */
export async function update(id: number, data: UpdateTagData): Promise<TaggableTable> {
  try {
    // Only include fields that are provided
    if (data.name !== undefined) {
      data.slug = await uniqueSlug(data.name, { table: 'taggables', column: 'slug' })
    }

    const result = await db
      .updateTable('taggables')
      .set(data)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update tag')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update tag: ${error.message}`)

    throw error
  }
}
