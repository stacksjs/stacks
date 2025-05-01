import type { PageJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a page by ID
 */
export async function fetchById(id: number): Promise<PageJsonResponse | undefined> {
  return await db
    .selectFrom('pages')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all pages
 */
export async function fetchAll(): Promise<PageJsonResponse[]> {
  return await db.selectFrom('pages').selectAll().execute()
}

/**
 * Fetch pages by template
 */
export async function fetchByTemplate(template: string): Promise<PageJsonResponse[]> {
  return await db
    .selectFrom('pages')
    .where('template', '=', template)
    .selectAll()
    .execute()
}

/**
 * Fetch pages by author
 */
export async function fetchByAuthor(authorId: number): Promise<PageJsonResponse[]> {
  return await db
    .selectFrom('pages')
    .where('author_id', '=', authorId)
    .selectAll()
    .execute()
}

/**
 * Fetch pages with minimum views
 */
export async function fetchByMinViews(minViews: number): Promise<PageJsonResponse[]> {
  return await db
    .selectFrom('pages')
    .where('views', '>=', minViews)
    .selectAll()
    .execute()
}

/**
 * Fetch pages with minimum conversions
 */
export async function fetchByMinConversions(minConversions: number): Promise<PageJsonResponse[]> {
  return await db
    .selectFrom('pages')
    .where('conversions', '>=', minConversions)
    .selectAll()
    .execute()
}

/**
 * Fetch pages published after a specific date
 */
export async function fetchPublishedAfter(timestamp: number): Promise<PageJsonResponse[]> {
  return await db
    .selectFrom('pages')
    .where('published_at', '>', timestamp)
    .selectAll()
    .execute()
}
