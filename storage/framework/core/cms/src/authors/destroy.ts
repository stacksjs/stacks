import type { AuthorJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Delete an author by ID
 *
 * @param id The ID of the author to delete
 * @returns The deleted author record
 */
export async function destroy(id: number): Promise<AuthorJsonResponse | undefined> {
  try {
    const result = await db
      .deleteFrom('authors')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to delete author: ${error.message}`)

    throw error
  }
}

/**
 * Delete multiple authors by IDs
 *
 * @param ids Array of author IDs to delete
 * @returns The number of deleted authors
 */
export async function destroyMany(ids: number[]): Promise<number> {
  try {
    const result = await db
      .deleteFrom('authors')
      .where('id', 'in', ids)
      .execute()

    return result.length
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to delete authors: ${error.message}`)

    throw error
  }
}
