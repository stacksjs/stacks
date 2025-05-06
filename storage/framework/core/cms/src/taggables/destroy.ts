import { db } from '@stacksjs/database'

/**
 * Delete a tag by its ID
 *
 * @param id The ID of the tag to delete
 * @returns void
 */
export async function destroy(id: number): Promise<void> {
  try {
    const result = await db
      .deleteFrom('taggables')
      .where('id', '=', id)
      .executeTakeFirst()

    if (!result) {
      throw new Error(`Tag with ID ${id} not found`)
    }
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete tag: ${error.message}`)
    }

    throw error
  }
}

/**
 * Delete multiple tags by their IDs
 *
 * @param ids An array of tag IDs to delete
 * @returns void
 */
export async function bulkDestroy(ids: number[]): Promise<void> {
  try {
    await db
      .deleteFrom('taggables')
      .where('id', 'in', ids)
      .execute()
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to delete tags: ${error.message}`)
    }

    throw error
  }
}
