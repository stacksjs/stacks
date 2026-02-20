type AuthorJsonResponse = ModelRow<typeof Author>
import { db } from '@stacksjs/database'

/**
 * Delete an author by ID
 *
 * @param id The ID of the author to delete
 * @returns The deleted author record
 */
export async function destroy(id: number): Promise<AuthorJsonResponse> {
  try {
    const result = await db
      .deleteFrom('authors')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error(`Author with ID ${id} not found`)
    }

    return result as AuthorJsonResponse
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Author with ID ${id} not found`)

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

    return Number(result) || 0
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to delete authors: ${error.message}`)

    throw error
  }
}
