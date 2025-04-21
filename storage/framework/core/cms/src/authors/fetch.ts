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
export async function fetchByName(name: string): Promise<AuthorJsonResponse[]> {
  return await db
    .selectFrom('authors')
    .where('name', '=', name)
    .selectAll()
    .execute()
}

/**
 * Fetch authors by email
 */
export async function fetchByEmail(email: string): Promise<AuthorJsonResponse[]> {
  return await db
    .selectFrom('authors')
    .where('email', '=', email)
    .selectAll()
    .execute()
}

/**
 * Fetch author by UUID
 */
export async function fetchByUuid(uuid: string): Promise<AuthorJsonResponse | undefined> {
  return await db
    .selectFrom('authors')
    .where('uuid', '=', uuid)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch authors by user ID
 */
export async function fetchByUserId(userId: number): Promise<AuthorJsonResponse[]> {
  return await db
    .selectFrom('authors')
    .where('user_id', '=', userId)
    .selectAll()
    .execute()
}
