import type { TaggableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

interface TagData {
  name: string
  description?: string
  is_active?: boolean
  taggable_type: string
}

/**
 * Create a new tag
 *
 * @param data The tag data to store
 * @returns The newly created tag record
 */
export async function store(data: TagData): Promise<TaggableTable> {
  try {
    const now = new Date()

    const tagData = {
      name: data.name,
      slug: slugify(data.name),
      description: data.description,
      is_active: data.is_active ?? true,
      created_at: now.toDateString(),
      taggable_id: data.taggable_id,
      taggable_type: data.taggable_type,
    }

    const result = await db
      .insertInto('taggable')
      .values(tagData)
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error('Failed to create tag')
    }

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to store tag: ${error.message}`)
    }

    throw error
  }
}
