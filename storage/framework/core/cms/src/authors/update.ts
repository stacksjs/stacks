type AuthorJsonResponse = ModelRow<typeof Author>
type NewAuthor = NewModelData<typeof Author>
import { getDb } from '../database'
import { fetchById } from './fetch'
import { isRow } from '../results'
import { HttpError } from '@stacksjs/error-handling'
import { formatDate, isUniqueViolation } from '@stacksjs/orm'

/**
 * Update an existing author
 *
 * @param id The ID of the author to update
 * @param data The author data to update
 * @returns The updated author record
 */
export async function update(id: number, data: Partial<NewAuthor>): Promise<AuthorJsonResponse | undefined> {
  const db = await getDb()
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

    // SQLite ignores RETURNING on UPDATE, so re-select by the known id.
    if (isRow<AuthorJsonResponse>(result))
      return result

    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    // Duplicate authors.email on update (#1957).
    if (isUniqueViolation(error))
      throw new HttpError(409, 'An author with this email already exists')
    if (error instanceof Error)
      throw new TypeError(`Failed to update author: ${error.message}`)

    throw error
  }
}
