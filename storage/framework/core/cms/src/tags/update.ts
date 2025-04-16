import type { TaggableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { slugify } from 'ts-slug'

interface UpdateTagData {
  id: number
  name?: string
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
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    // Only include fields that are provided
    if (data.name !== undefined) {
      updateData.name = data.name
      updateData.slug = slugify(data.name)
    }

    const result = await db
      .updateTable('taggable')
      .set(updateData)
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
