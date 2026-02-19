type PostJsonResponse = ModelRow<typeof Post>
import { db } from '@stacksjs/database'

/**
 * Fetch a post by ID
 */
export async function fetchById(id: number): Promise<PostJsonResponse | undefined> {
  return await db
    .selectFrom('posts')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as PostJsonResponse | undefined
}

/**
 * Fetch all posts
 */
export async function fetchAll(): Promise<PostJsonResponse[]> {
  return await db.selectFrom('posts').selectAll().execute() as PostJsonResponse[]
}

/**
 * Fetch posts by status
 */
export async function fetchByStatus(status: 'published' | 'draft' | 'archived'): Promise<PostJsonResponse[]> {
  return await db
    .selectFrom('posts')
    .where('status', '=', status)
    .selectAll()
    .execute() as PostJsonResponse[]
}

/**
 * Fetch posts by category
 */
export async function fetchByCategory(category: string): Promise<PostJsonResponse[]> {
  return await db
    .selectFrom('posts')
    .where('category', '=', category)
    .selectAll()
    .execute() as PostJsonResponse[]
}

/**
 * Fetch posts by author
 */
export async function fetchByAuthor(author: string): Promise<PostJsonResponse[]> {
  return await db
    .selectFrom('posts')
    .where('author', '=', author)
    .selectAll()
    .execute() as PostJsonResponse[]
}

/**
 * Fetch posts with minimum views
 */
export async function fetchByMinViews(minViews: number): Promise<PostJsonResponse[]> {
  return await db
    .selectFrom('posts')
    .where('views', '>=', minViews)
    .selectAll()
    .execute() as PostJsonResponse[]
}

/**
 * Fetch posts published after a specific date
 */
export async function fetchPublishedAfter(timestamp: number): Promise<PostJsonResponse[]> {
  return await db
    .selectFrom('posts')
    .where('published_at', '>', timestamp)
    .selectAll()
    .execute() as PostJsonResponse[]
}
