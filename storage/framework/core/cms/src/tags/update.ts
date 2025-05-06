import type { TaggableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

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
 * @param data The tag data to update
 * @returns The updated tag record
 */
export async function update(data: UpdateTagData): Promise<TaggableTable> {
  try {
    // Only include fields that are provided
    if (data.name !== undefined) {
      data.slug = slugify(data.name)
    }

    const result = await db
      .updateTable('taggable')
      .set(data)
      .where('id', '=', data.id)
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
