import type { CategoryJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a category by ID
 */
export async function fetchById(id: number): Promise<CategoryJsonResponse | undefined> {
  return await db
    .selectFrom('categorizable')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all categories
 */
export async function fetchAll(): Promise<CategoryJsonResponse[]> {
  return await db.selectFrom('categorizable').selectAll().execute()
}

/**
 * Fetch categories by name
 */
export async function fetchByName(name: string): Promise<CategoryJsonResponse[]> {
  return await db
    .selectFrom('categorizable')
    .where('name', '=', name)
    .selectAll()
    .execute()
}

/**
 * Fetch category by slug
 */
export async function fetchBySlug(slug: string): Promise<CategoryJsonResponse | undefined> {
  return await db
    .selectFrom('categorizable')
    .where('slug', '=', slug)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch categories with posts
 */
export async function fetchWithPosts(id: number): Promise<CategoryJsonResponse | undefined> {
  return await db
    .selectFrom('categorizable')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}
