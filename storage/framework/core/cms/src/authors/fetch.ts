import type { AuthorJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch an author by ID
 */
export async function fetchById(id: number): Promise<AuthorJsonResponse | undefined> {
  return await db
    .selectFrom('authors')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all authors
 */
export async function fetchAll(): Promise<AuthorJsonResponse[]> {
  return await db.selectFrom('authors').selectAll().execute()
}

/**
 * Fetch authors by name
 */
export async function findByName(name: string): Promise<AuthorJsonResponse | undefined> {
  return await db
    .selectFrom('authors')
    .where('name', '=', name)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch authors by email
 */
export async function findByEmail(email: string): Promise<AuthorJsonResponse | undefined> {
  return await db
    .selectFrom('authors')
    .where('email', '=', email)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch author by UUID
 */
export async function findByUuid(uuid: string): Promise<AuthorJsonResponse | undefined> {
  return await db
    .selectFrom('authors')
    .where('uuid', '=', uuid)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch authors by user ID
 */
export async function findByUserId(userId: number): Promise<AuthorJsonResponse | undefined> {
  return await db
    .selectFrom('authors')
    .where('user_id', '=', userId)
    .selectAll()
    .executeTakeFirst()
}
