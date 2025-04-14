import type { TaggableTable } from '@stacksjs/orm'
import type { Request } from '@stacksjs/router'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { slugify } from 'ts-slug'

type TagUpdate = Omit<TaggableTable, 'updated_at'>
/**
 * Update a tag
 *
 * @param id The ID of the tag to update
 * @param data The data to update
 * @returns The updated tag record
 */
export async function update(id: number, request: Request): Promise<TaggableTable> {
  try {
    await request.validate()

    const now = formatDate(new Date())

    const tagData: TagUpdate = {
      name: request.get('name'),
      slug: slugify(request.get('name')),
      description: request.get('description'),
      is_active: request.get('is_active'),
      created_at: now,
      taggable_id: request.get('taggable_id'),
      taggable_type: request.get('taggable_type'),
    }

    const result = await db
      .updateTable('taggable')
      .set(tagData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error(`Tag with ID ${id} not found`)
    }

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update tag: ${error.message}`)
    }

    throw error
  }
}
