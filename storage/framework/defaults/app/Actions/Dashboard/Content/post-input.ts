import type { RequestInstance } from '@stacksjs/types'
import { db } from '@stacksjs/database'
import { insertedId, str, timestamp } from './content-input'

export { insertedId, timestamp }

export interface PostPayload {
  title: string
  excerpt: string
  content: string
  poster: string
  status: string
  authorId: number | null
  featured: boolean
  categoryIds: number[]
  tagIds: number[]
}

/**
 * The `posts` table has a CHECK constraint on ('published', 'draft', 'archived'),
 * so anything else — including a capitalized 'Draft' — fails the insert. Fold
 * casing and fall back to 'draft' rather than letting a bad value reach SQL.
 */
export function normalizeStatus(value: unknown): string {
  const status = str(value).toLowerCase()

  return status === 'published' || status === 'archived' ? status : 'draft'
}

/**
 * A post only carries a `published_at` while it is published.
 *
 * An already-published post keeps its original timestamp so re-saving doesn't
 * silently republish it, and unpublishing clears the date instead of leaving a
 * stale one behind.
 */
export function publishedAtFor(status: string, existing: string | null, now: string): string | null {
  if (status !== 'published')
    return null

  return existing || now
}

/** Reads a post row back after a write — see `findRow` for why writes re-select. */
export async function findPost(id: number, database: typeof db = db): Promise<unknown> {
  return await database.selectFrom('posts').selectAll().where('id', '=', id).executeTakeFirst()
}

function ids(value: unknown): number[] {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  return [...new Set(values
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0))]
}

function optionalId(value: unknown): number | null {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on'
}

export function invalidPostContent(payload: PostPayload): string | null {
  if (payload.title.length < 3 || payload.title.length > 255)
    return 'Title must be between 3 and 255 characters.'
  if (payload.content.trim().length < 10 || payload.content.length > 100000)
    return 'Content must be between 10 and 100000 characters.'
  if (payload.excerpt && (payload.excerpt.trim().length < 10 || payload.excerpt.length > 500))
    return 'Excerpt must be between 10 and 500 characters when provided.'
  if (payload.poster) {
    try {
      const url = new URL(payload.poster)
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        return 'Poster must use an http or https URL.'
    }
    catch {
      return 'Poster must be a valid URL.'
    }
  }

  return null
}

export async function invalidPostReference(payload: PostPayload, database: typeof db = db): Promise<string | null> {
  const [author, categoryRows, tagRows] = await Promise.all([
    payload.authorId
      ? database.selectFrom('authors').select(['id']).where('id', '=', payload.authorId).executeTakeFirst()
      : Promise.resolve(undefined),
    payload.categoryIds.length
      ? database.selectFrom('categories').whereIn('id', payload.categoryIds).select(['id']).execute()
      : Promise.resolve([]),
    payload.tagIds.length
      ? database.selectFrom('tags').whereIn('id', payload.tagIds).select(['id']).execute()
      : Promise.resolve([]),
  ])

  if (payload.authorId && !author)
    return 'The selected author does not exist.'
  if (categoryRows.length !== payload.categoryIds.length)
    return 'One or more selected categories do not exist.'
  if (tagRows.length !== payload.tagIds.length)
    return 'One or more selected tags do not exist.'

  return null
}

async function replacePostPivot(
  database: typeof db,
  table: 'categorizable_models' | 'taggable_models',
  foreignKey: 'category_id' | 'tag_id',
  ownerKey: 'categorizable_id' | 'taggable_id',
  typeKey: 'categorizable_type' | 'taggable_type',
  postId: number,
  relatedIds: number[],
  now: string,
): Promise<void> {
  await (database as any)
    .deleteFrom(table)
    .where(ownerKey, '=', postId)
    .where(typeKey, '=', 'posts')
    .execute()

  if (relatedIds.length === 0)
    return

  await (database as any)
    .insertInto(table)
    .values(relatedIds.map(relatedId => ({
      [foreignKey]: relatedId,
      [ownerKey]: postId,
      [typeKey]: 'posts',
      created_at: now,
      updated_at: now,
    })))
    .execute()
}

/** Replaces both post pivot sets on the caller's database or transaction. */
export async function syncPostRelations(database: typeof db, postId: number, payload: Pick<PostPayload, 'categoryIds' | 'tagIds'>): Promise<void> {
  const now = timestamp()
  await replacePostPivot(database, 'categorizable_models', 'category_id', 'categorizable_id', 'categorizable_type', postId, payload.categoryIds, now)
  await replacePostPivot(database, 'taggable_models', 'tag_id', 'taggable_id', 'taggable_type', postId, payload.tagIds, now)
}

/** Removes both post pivot sets on the caller's database or transaction. */
export async function detachPostRelations(database: typeof db, postId: number): Promise<void> {
  await (database as any)
    .deleteFrom('categorizable_models')
    .where('categorizable_id', '=', postId)
    .where('categorizable_type', '=', 'posts')
    .execute()
  await (database as any)
    .deleteFrom('taggable_models')
    .where('taggable_id', '=', postId)
    .where('taggable_type', '=', 'posts')
    .execute()
}

/** Maps a dashboard request body onto the writable post columns. */
export function postPayload(request: RequestInstance): PostPayload {
  return {
    title: str(request.get('title')).trim(),
    excerpt: str(request.get('excerpt')),
    content: str(request.get('content') || request.get('body')),
    poster: str(request.get('poster')),
    status: normalizeStatus(request.get('status')),
    authorId: optionalId(request.get('authorId') ?? request.get('author_id')),
    featured: booleanValue(request.get('featured') ?? request.get('is_featured')),
    categoryIds: ids(request.get('categoryIds') ?? request.get('category_ids')),
    tagIds: ids(request.get('tagIds') ?? request.get('tag_ids')),
  }
}
