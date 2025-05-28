import type { AuthorJsonResponse, NewAuthor } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

interface AuthorData {
  name: string
  email: string
}
/**
 * Find an existing author by name or email, or create a new one if not found
 *
 * @param data The author data to find or create
 * @returns The found or created author record
 */
export async function findOrCreate(data: AuthorData): Promise<AuthorJsonResponse> {
  try {
    // First, try to find an existing author by email or name
    const existingAuthor = await db
      .selectFrom('authors')
      .where(eb => eb.or([
        eb('email', '=', data.email),
        eb('name', '=', data.name),
      ]))
      .selectAll()
      .executeTakeFirst()

    // If author exists, return it
    if (existingAuthor)
      return existingAuthor

    // Look up or create the associated user
    let user = await db
      .selectFrom('users')
      .where('email', '=', data.email)
      .selectAll()
      .executeTakeFirst()

    if (!user) {
      // Create a new user if one doesn't exist
      const result = await db
        .insertInto('users')
        .values({
          email: data.email,
          name: data.name,
          password: randomUUIDv7(),
          uuid: randomUUIDv7(),
          created_at: formatDate(new Date()),
          updated_at: formatDate(new Date()),
        })
        .returningAll()
        .executeTakeFirst()

      if (!result)
        throw new Error('Failed to create user')

      user = result
    }

    // Create a new author with the user_id
    const authorData: NewAuthor = {
      user_id: user.id,
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
      throw new TypeError(`Failed to find or create author: ${error.message}`)

    throw error
  }
}

/**
 * Find or create an author by name or email
 *
 * @param data The author data to find or create
 * @returns The found or created author record
 */
export async function store(data: NewAuthor): Promise<AuthorJsonResponse> {
  try {
    // First, try to find an existing author by email or name
    const existingAuthor = await db
      .selectFrom('authors')
      .where(eb => eb.or([
        eb('email', '=', data.email),
        eb('name', '=', data.name),
      ]))
      .selectAll()
      .executeTakeFirst()

    // If author exists, return it
    if (existingAuthor)
      return existingAuthor

    // If no existing author, create a new one
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
      throw new TypeError(`Failed to find or create author: ${error.message}`)

    throw error
  }
}
