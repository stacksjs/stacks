import type { AuthorJsonResponse, NewAuthor } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update an existing author
 *
 * @param id The ID of the author to update
 * @param data The author data to update
 * @returns The updated author record
 */
export async function update(id: number, data: Partial<NewAuthor>): Promise<AuthorJsonResponse | undefined> {
  try {
    const updateData = {
      ...data,
      updated_at: formatDate(new Date()),
    }

    const result = await db
      .updateTable('authors')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update author: ${error.message}`)

    throw error
  }
}
