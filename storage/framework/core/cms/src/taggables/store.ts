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
 * Find or create multiple tags by their names
 *
 * @param names Array of tag names to process
 * @param taggableType The type of model these tags belong to
 * @returns Array of tag IDs
 */
export async function findOrCreateMany(names: string[], taggableType: string): Promise<number[]> {
  const tagIds: number[] = []

  for (const name of names) {
    const tag = await findOrCreate({ name, taggable_type: taggableType })
    tagIds.push(tag.id!)
  }

  return tagIds
}

/**
 * Find or create a single tag
 *
 * @param data The tag data
 * @returns The found or created tag
 */
export async function findOrCreate(data: TagData): Promise<TaggableTable> {
  try {
    // Try to find existing tag
    const existingTag = await db
      .selectFrom('taggables')
      .selectAll()
      .where('name', '=', data.name)
      .executeTakeFirst()

    if (existingTag)
      return existingTag

    // If not found, create new tag
    return await store(data)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to find or create tag: ${error.message}`)
    }
    throw error
  }
}

/**
 * Create a new tag
 *
 * @param data The tag data to store
 * @returns The newly created tag record
 */
export async function store(data: TagData): Promise<TaggableTable> {
  try {
    const tagData = {
      name: data.name,
      slug: slugify(data.name),
      description: data.description,
      is_active: data.is_active ?? true,
      taggable_type: data.taggable_type,
    }

    const result = await db
      .insertInto('taggables')
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
