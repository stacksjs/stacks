type PageJsonResponse = ModelRow<typeof Page>
type PageUpdate = UpdateModelData<typeof Page>
import { getDb } from '../database'
import { fetchById } from './fetch'
import { isRow } from '../results'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a page
 *
 * @param id The id of the page to update
 * @param data The page data to update
 * @returns The updated page record
 */
export async function update(id: number, data: Partial<PageUpdate>): Promise<PageJsonResponse> {
  const db = await getDb()
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

    // SQLite ignores RETURNING on UPDATE (result is { changes, ... }, and its
    // lastInsertRowid is stale), so re-select by the id we already have.
    if (isRow<PageJsonResponse>(result))
      return result

    const page = await fetchById(id)

    if (!page)
      throw new Error('Failed to update page')

    return page as PageJsonResponse
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update page: ${error.message}`)

    throw error
  }
}
