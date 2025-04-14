import type { TaggableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a tag by its ID
 *
 * @param id The ID of the tag to fetch
 * @returns The tag record if found
 */
export async function fetchTagById(id: number): Promise<TaggableTable> {
  try {
    const result = await db
      .selectFrom('taggable')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    if (!result) {
      throw new Error(`Tag with ID ${id} not found`)
    }

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch tag: ${error.message}`)
    }

    throw error
  }
}

/**
 * Fetch all tags
 *
 * @returns An array of tag records
 */
export async function fetchTags(): Promise<TaggableTable[]> {
  try {
    return await db
      .selectFrom('taggable')
      .selectAll()
      .orderBy('order', 'asc')
      .execute()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch tags: ${error.message}`)
    }

    throw error
  }
}
