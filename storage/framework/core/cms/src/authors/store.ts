import type { NewAuthor, AuthorJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'

/**
 * Create a new author
 *
 * @param data The author data to create
 * @returns The created author record
 */
export async function store(data: NewAuthor): Promise<AuthorJsonResponse> {
  try {
    const authorData: NewAuthor = {
      user_id: data.user_id,
      name: data.name,
      email: data.email,
      uuid: randomUUIDv7(),
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    }

    const result = await db
      .insertInto('authors')
      .values(authorData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create author')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create author: ${error.message}`)

    throw error
  }
}
