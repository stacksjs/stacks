import { db } from '@stacksjs/database'

/**
 * Delete a tag by its ID
 *
 * @param id The ID of the tag to delete
 * @returns void
 */
export async function destroy(id: number): Promise<void> {
  // First check if the tag exists
  const tag = await db
    .selectFrom('taggables')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  if (!tag) {
    throw new Error(`Tag with ID ${id} not found`)
  }

  await db
    .deleteFrom('taggables')
    .where('id', '=', id)
    .executeTakeFirst()
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
