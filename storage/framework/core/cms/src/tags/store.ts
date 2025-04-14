import type { TaggableTable } from '@stacksjs/orm'
import type { Request } from '@stacksjs/router'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'
type TagStore = Omit<TaggableTable, 'updated_at'>

/**
 * Create a new tag
 *
 * @param data The tag data to store
 * @returns The newly created tag record
 */
export async function store(request: Request): Promise<TaggableTable> {
  try {
    await request.validate()

    const now = new Date()

    const tagData: TagStore = {
      name: request.get('name'),
      slug: slugify(request.get('name')),
      description: request.get('description'),
      is_active: request.get('is_active'),
      created_at: now.toDateString(),
      taggable_id: request.get('taggable_id'),
      taggable_type: request.get('taggable_type'),
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
