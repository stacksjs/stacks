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

/**
 * Count the number of posts that have been tagged
 *
 * @param taggableType The type of entity to count (e.g. 'posts')
 * @returns The count of tagged posts
 */
export async function countTaggedPosts(taggableType: string): Promise<number> {
  try {
    const result = await db
      .selectFrom('taggable_models')
      .select(({ fn }) => [
        fn.count<number>('id').as('count'),
      ])
      .where('taggable_type', '=', taggableType)
      .executeTakeFirst()

    return result?.count || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to count tagged posts: ${error.message}`)
    }

    throw error
  }
}

/**
 * Count the total number of tags in the system
 *
 * @returns The total count of tags
 */
export async function countTotalTags(): Promise<number> {
  try {
    const result = await db
      .selectFrom('taggable')
      .select(({ fn }) => [
        fn.count<number>('id').as('count'),
      ])
      .executeTakeFirst()

    return result?.count || 0
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to count total tags: ${error.message}`)
    }

    throw error
  }
}

/**
 * Find the most used tag in the system
 *
 * @param taggableType Optional type to filter by (e.g. 'posts', 'articles')
 * @returns The most used tag name and its count
 */
export async function findMostUsedTag(taggableType?: string): Promise<{ name: string; count: number } | null> {
  try {
    let query = db
      .selectFrom('taggable_models')
      .innerJoin('taggable', 'taggable.id', 'taggable_models.tag_id')
      .select(({ fn }) => [
        'taggable.name',
        fn.count<number>('taggable_models.id').as('usage_count'),
      ])
      .groupBy('taggable.name')

    if (taggableType)
      query = query.where('taggable_models.taggable_type', '=', taggableType)

    const result = await query
      .orderBy('usage_count', 'desc')
      .executeTakeFirst()

    if (!result) {
      return null
    }

    return {
      name: result.name,
      count: result.usage_count,
    }
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to find most used tag: ${error.message}`)
    }

    throw error
  }
}

/**
 * Find the least used tag in the system
 *
 * @returns The least used tag name and its count
 */
export async function findLeastUsedTag(): Promise<{ name: string; count: number } | null> {
  try {
    const result = await db
      .selectFrom('taggable_models')
      .innerJoin('taggable', 'taggable.id', 'taggable_models.tag_id')
      .select(({ fn }) => [
        'taggable.name',
        fn.count<number>('taggable_models.id').as('usage_count'),
      ])
      .groupBy('taggable.name')
      .orderBy('usage_count', 'asc')
      .executeTakeFirst()

    if (!result) {
      return null
    }

    return {
      name: result.name,
      count: result.usage_count,
    }
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to find least used tag: ${error.message}`)
    }

    throw error
  }
}

/**
 * Fetch tags with their post counts
 *
 * @returns Array of tags with their post counts
 */
export async function fetchTagsWithPostCounts(): Promise<Array<{ name: string; postCount: number }>> {
  try {
    const result = await db
      .selectFrom('taggable')
      .leftJoin('taggable_models', (join) => join
        .onRef('taggable.id', '=', 'taggable_models.tag_id')
        .on('taggable_models.taggable_type', '=', 'posts'))
      .select(({ fn }) => [
        'taggable.name',
        fn.count<number>('taggable_models.id').as('post_count'),
      ])
      .groupBy('taggable.name')
      .orderBy('post_count', 'desc')
      .limit(10)
      .execute()

    return result.map(row => ({
      name: row.name,
      postCount: Number(row.post_count),
    }))
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch tags with post counts: ${error.message}`)
    }

    throw error
  }
}

/**
 * Fetch tag distribution data for a donut graph
 *
 * @returns Array of tags with their counts and percentages
 */
export async function fetchTagDistribution(): Promise<Array<{ name: string; count: number; percentage: number }>> {
  try {
    const result = await db
      .selectFrom('taggable')
      .leftJoin('taggable_models', (join) => join
        .onRef('taggable.id', '=', 'taggable_models.tag_id')
        .on('taggable_models.taggable_type', '=', 'posts'))
      .select(({ fn }) => [
        'taggable.name',
        fn.count<number>('taggable_models.id').as('count'),
      ])
      .groupBy('taggable.name')
      .orderBy('count', 'desc')
      .execute()

    // Calculate total count for percentage calculation
    const totalCount = result.reduce((sum, row) => sum + Number(row.count), 0)

    return result.map(row => ({
      name: row.name,
      count: Number(row.count),
      percentage: totalCount > 0 ? (Number(row.count) / totalCount) * 100 : 0,
    }))
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch tag distribution: ${error.message}`)
    }

    throw error
  }
}
