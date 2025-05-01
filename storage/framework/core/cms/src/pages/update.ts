import type { PageJsonResponse, PageUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a page
 *
 * @param id The id of the page to update
 * @param data The page data to update
 * @returns The updated page record
 */
export async function update(id: number, data: Partial<PageUpdate>): Promise<PageJsonResponse> {
  try {
    const updateData = {
      ...data,
      updated_at: formatDate(new Date()),
    }

    const result = await db
      .updateTable('pages')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update page')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update page: ${error.message}`)

    throw error
  }
}
