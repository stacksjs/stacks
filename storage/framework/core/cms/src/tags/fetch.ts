import type { TaggableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

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
      .execute()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch tags: ${error.message}`)
    }

    throw error
  }
}

/**
 * Find a tag by name or create it if it doesn't exist
 *
 * @param name The name of the tag to find or create
 * @param taggableId ID of the taggable entity
 * @param taggableType Type of the taggable entity
 * @param description Optional description for the tag
 * @returns The existing or newly created tag
 */
export async function firstOrCreate(
  name: string,
  taggableId: number,
  taggableType: string,
  description?: string,
): Promise<TaggableTable> {
  try {
    // First try to find the tag by name
    const existingTag = await db
      .selectFrom('taggable')
      .selectAll()
      .where('name', '=', name)
      .executeTakeFirst()

    if (existingTag) {
      return existingTag
    }

    // If tag doesn't exist, create it
    const now = new Date()
    const tagData = {
      name,
      slug: slugify(name),
      description,
      is_active: true,
      created_at: now.toDateString(),
      taggable_id: taggableId,
      taggable_type: taggableType,
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
      throw new TypeError(`Failed to find or create tag: ${error.message}`)
    }

    throw error
  }
}
