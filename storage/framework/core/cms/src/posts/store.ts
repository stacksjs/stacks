import type { NewPost, PostJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

export const POST_STATUS_DRAFT = 'Draft'
export const POST_STATUS_PUBLISHED = 'Published'
export const POST_STATUS_ARCHIVED = 'Archived'

/**
 * Create a new post
 *
 * @param data The post data to create
 * @returns The created post record
 */
export async function store(data: NewPost): Promise<PostJsonResponse> {
  try {
    const postData = {
      author_id: data.author_id,
      uuid: randomUUIDv7(),
      title: data.title,
      poster: data.poster,
      content: data.content,
      excerpt: data.excerpt,
      is_featured: data.is_featured ? Date.now() : undefined,
      views: data.views || 0,
      published_at: data.published_at || Date.now(),
      status: data.status || POST_STATUS_DRAFT,
    }

    const result = await db
      .insertInto('posts')
      .values(postData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create post')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create post: ${error.message}`)

    throw error
  }
}

/**
 * Attach related records to a post through a pivot table
 *
 * @param postId The ID of the post to attach records to
 * @param tableName The name of the pivot table (e.g., 'categorizable_models', 'taggable')
 * @param ids Array of IDs to attach
 * @returns Promise<void>
 */
export async function attach(
  postId: number,
  tableName: 'categorizable_models' | 'taggable_models',
  ids: number[],
): Promise<void> {
  try {
    // Get the foreign key names based on the table name
    const postForeignKey = tableName === 'categorizable_models' ? 'categorizable_id' : 'taggable_id'
    const postTypeField = tableName === 'categorizable_models' ? 'categorizable_type' : 'taggable_type'

    const tablePrimary = tableName === 'categorizable_models' ? 'category_id' : 'tag_id'

    // Prepare the data for insertion
    const pivotData = ids.map((id: number) => ({
      [tablePrimary]: id,
      [postForeignKey]: postId,
      [postTypeField]: 'posts',
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    }))

    for (const data of pivotData) {
      await db
        .insertInto(tableName)
        .values(data)
        .execute()
    }
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to attach records: ${error.message}`)

    throw error
  }
}

/**
 * Detach related records from a post through a pivot table
 *
 * @param postId The ID of the post to detach records from
 * @param tableName The name of the pivot table (e.g., 'categorizable_models', 'taggable')
 * @param ids Optional array of IDs to detach. If not provided, all related records will be detached
 * @returns Promise<void>
 */
export async function detach(
  postId: number,
  tableName: 'categorizable_models' | 'taggable_models',
  ids?: number[],
): Promise<void> {
  try {
    // Get the foreign key names based on the table name
    const postForeignKey = tableName === 'categorizable_models' ? 'categorizable_id' : 'taggable_id'
    const postTypeField = tableName === 'categorizable_models' ? 'categorizable_type' : 'taggable_type'

    // Build the delete query
    await db
      .deleteFrom(tableName)
      .where(postForeignKey, '=', postId)
      .where(postTypeField, '=', 'posts')
      .where('id', 'in', ids)
      .execute()
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to detach records: ${error.message}`)

    throw error
  }
}

/**
 * Synchronize related records for a post through a pivot table
 * This will detach relationships not in the new set and attach only new relationships
 *
 * @param postId The ID of the post to sync records for
 * @param tableName The name of the pivot table (e.g., 'categorizable_models', 'taggable')
 * @param ids Array of IDs to sync
 * @returns Promise<void>
 */
export async function sync(
  postId: number,
  tableName: 'categorizable_models' | 'taggable_models',
  ids: number[],
): Promise<void> {
  try {
    // Get the foreign key names based on the table name
    const postForeignKey = tableName === 'categorizable_models' ? 'categorizable_id' : 'taggable_id'
    const postTypeField = tableName === 'categorizable_models' ? 'categorizable_type' : 'taggable_type'

    // Get existing relationships
    const existingRelations = await db
      .selectFrom(tableName)
      .select('id')
      .where(postForeignKey, '=', postId)
      .where(postTypeField, '=', 'posts')
      .execute()

    const existingIds = existingRelations.map((rel: { id: number }) => rel.id)

    // Find IDs to remove (in existing but not in new set)
    const idsToRemove = existingIds.filter((id: number) => !ids.includes(id))

    // Find IDs to add (in new set but not in existing)
    const idsToAdd = ids.filter(id => !existingIds.includes(id))

    // Remove relationships that are no longer needed
    if (idsToRemove.length > 0) {
      await db
        .deleteFrom(tableName)
        .where(postForeignKey, '=', postId)
        .where(postTypeField, '=', 'posts')
        .where('id', 'in', idsToRemove)
        .execute()
    }

    // Add new relationships
    if (idsToAdd.length > 0) {
      const pivotData = idsToAdd.map(() => ({
        [postForeignKey]: postId,
        [postTypeField]: 'posts',
        created_at: formatDate(new Date()),
        updated_at: formatDate(new Date()),
      }))

      await db
        .insertInto(tableName)
        .values(pivotData)
        .execute()
    }
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to sync records: ${error.message}`)

    throw error
  }
}
