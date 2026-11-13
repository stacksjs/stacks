type PostJsonResponse = ModelRow<typeof Post>
import { getDb } from '../database'

/**
 * A row read from `posts`, as the post its type says it is.
 *
 * `is_featured` is a yes or no. PostgreSQL hands one back as `true` or
 * `false`, SQLite and MySQL as 1 or 0, and a post's is a boolean on all three,
 * so the row is given what its type promises instead of being cast to it.
 */
function asPost(row: unknown): PostJsonResponse | undefined {
  if (row === null || typeof row !== 'object')
    return undefined
  const post = { ...(row as Record<string, unknown>) }
  if (post.is_featured !== null && post.is_featured !== undefined)
    post.is_featured = post.is_featured === true || post.is_featured === 1 || post.is_featured === '1'
  return post as PostJsonResponse
}

function asPosts(rows: unknown[]): PostJsonResponse[] {
  return rows.map(row => asPost(row)!)
}

/**
 * Fetch a post by ID
 */
export async function fetchById(id: number): Promise<PostJsonResponse | undefined> {
  const db = await getDb()
  return asPost(await db
    .selectFrom('posts')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst())
}

/**
 * Fetch all posts
 */
export async function fetchAll(): Promise<PostJsonResponse[]> {
  const db = await getDb()
  return asPosts(await db.selectFrom('posts').selectAll().execute())
}

/**
 * Fetch posts by status
 */
export async function fetchByStatus(status: 'published' | 'draft' | 'archived'): Promise<PostJsonResponse[]> {
  const db = await getDb()
  return asPosts(await db
    .selectFrom('posts')
    .where('status', '=', status)
    .selectAll()
    .execute())
}

/**
 * Fetch posts by category
 */
export async function fetchByCategory(category: string): Promise<PostJsonResponse[]> {
  const db = await getDb()
  return asPosts(await db
    .selectFrom('posts')
    .where('category', '=', category)
    .selectAll()
    .execute())
}

/**
 * Fetch posts by author
 */
export async function fetchByAuthor(authorId: number): Promise<PostJsonResponse[]> {
  const db = await getDb()
  return asPosts(await db
    .selectFrom('posts')
    .where('author_id', '=', authorId)
    .selectAll()
    .execute())
}

/**
 * Fetch posts with minimum views
 */
export async function fetchByMinViews(minViews: number): Promise<PostJsonResponse[]> {
  const db = await getDb()
  return asPosts(await db
    .selectFrom('posts')
    .where('views', '>=', minViews)
    .selectAll()
    .execute())
}

/**
 * Fetch posts published after a specific date
 */
export async function fetchPublishedAfter(timestamp: number): Promise<PostJsonResponse[]> {
  const db = await getDb()
  return asPosts(await db
    .selectFrom('posts')
    .where('published_at', '>', timestamp)
    .selectAll()
    .execute())
}
