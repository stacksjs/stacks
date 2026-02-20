import type { TaggableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { findOrCreate } from './store'

/**
 * Fetch a tag by its ID
 *
 * @param id The ID of the tag to fetch
 * @returns The tag record if found
 */
export async function fetchTagById(id: number): Promise<TaggableTable | undefined> {
  try {
    const result = await db
      .selectFrom('taggables')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    if (!result) {
      return undefined
    }

    return result as unknown as TaggableTable
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
      .selectFrom('taggables')
      .where('is_active', '=', true)
      .selectAll()
      .execute() as unknown as unknown as TaggableTable[]
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
 * @param taggableType Type of the taggable entity
 * @param description Optional description for the tag
 * @returns The existing or newly created tag
 */
export async function firstOrCreate(
  name: string,
  taggableType: string,
  description?: string,
): Promise<TaggableTable> {
  try {
    return await findOrCreate({
      name,
      taggable_type: taggableType,
      description,
    })
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
      .where('taggable_type', '=', taggableType)
      .count()

    return Number(result) || 0
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
      .selectFrom('taggables')
      .count()

    return Number(result) || 0
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
export async function findMostUsedTag(taggableType?: string): Promise<{ name: string, count: number } | null> {
  try {
    let query = db
      .selectFrom('taggable_models')
      .innerJoin('taggables', 'taggables.id', '=', 'taggable_models.tag_id')
      .select([
        'taggables.name',
      ])
      .groupBy('taggables.name') as any

    if (taggableType)
      query = query.where('taggable_models.taggable_type', '=', taggableType)

    const result = await query
      .orderBy('taggables.name', 'asc')
      .executeTakeFirst()

    if (!result) {
      return null
    }

    return {
      name: (result as Record<string, unknown>).name as string,
      count: Number((result as Record<string, unknown>).usage_count || 0),
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
export async function findLeastUsedTag(): Promise<{ name: string, count: number } | null> {
  try {
    const result = await (db
      .selectFrom('taggable_models')
      .innerJoin('taggables', 'taggables.id', '=', 'taggable_models.tag_id')
      .select([
        'taggables.name',
      ])
      .groupBy('taggables.name') as any)
      .orderBy('taggables.name', 'asc')
      .executeTakeFirst()

    if (!result) {
      return null
    }

    return {
      name: (result as Record<string, unknown>).name as string,
      count: Number((result as Record<string, unknown>).usage_count || 0),
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
export async function fetchTagsWithPostCounts(): Promise<Array<{ name: string, postCount: number }>> {
  try {
    const result = await (db
      .selectFrom('taggables')
      .leftJoin('taggable_models', 'taggables.id', '=', 'taggable_models.tag_id')
      .select([
        'taggables.name',
      ])
      .groupBy('taggables.name') as any)
      .orderBy('taggables.name', 'desc')
      .limit(10)
      .execute()

    return (result as Record<string, unknown>[]).map((row: Record<string, unknown>) => ({
      name: row.name as string,
      postCount: Number(row.post_count || 0),
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
export async function fetchTagDistribution(): Promise<Array<{ name: string, count: number, percentage: number }>> {
  try {
    const result = await (db
      .selectFrom('taggables')
      .leftJoin('taggable_models', 'taggables.id', '=', 'taggable_models.tag_id')
      .select([
        'taggables.name',
      ])
      .groupBy('taggables.name') as any)
      .orderBy('taggables.name', 'desc')
      .execute()

    const typedResult = result as Record<string, unknown>[]

    // Calculate total count for percentage calculation
    const totalCount = typedResult.reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.count || 0), 0)

    return typedResult.map((row: Record<string, unknown>) => ({
      name: row.name as string,
      count: Number(row.count || 0),
      percentage: totalCount > 0 ? (Number(row.count || 0) / totalCount) * 100 : 0,
    }))
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to fetch tag distribution: ${error.message}`)
    }

    throw error
  }
}
