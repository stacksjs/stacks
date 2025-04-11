import type { PostCategoryJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a category by ID
 */
export async function fetchById(id: number): Promise<PostCategoryJsonResponse | undefined> {
  return await db
    .selectFrom('post_categories')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all categories
 */
export async function fetchAll(): Promise<PostCategoryJsonResponse[]> {
  return await db.selectFrom('post_categories').selectAll().execute()
}

/**
 * Fetch categories by name
 */
export async function fetchByName(name: string): Promise<PostCategoryJsonResponse[]> {
  return await db
    .selectFrom('post_categories')
    .where('name', '=', name)
    .selectAll()
    .execute()
}

/**
 * Fetch category by slug
 */
export async function fetchBySlug(slug: string): Promise<PostCategoryJsonResponse | undefined> {
  return await db
    .selectFrom('post_categories')
    .where('slug', '=', slug)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch categories with posts
 */
export async function fetchWithPosts(id: number): Promise<PostCategoryJsonResponse | undefined> {
  return await db
    .selectFrom('post_categories')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}
