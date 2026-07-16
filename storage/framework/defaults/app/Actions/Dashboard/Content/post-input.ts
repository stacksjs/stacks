import type { RequestInstance } from '@stacksjs/types'
import { db } from '@stacksjs/database'
import { str } from './content-input'

export { insertedId, timestamp } from './content-input'

export interface PostPayload {
  title: string
  excerpt: string
  content: string
  poster: string
  status: string
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
export async function findPost(id: number): Promise<unknown> {
  return await db.selectFrom('posts').selectAll().where('id', '=', id).executeTakeFirst()
}

/** Maps a dashboard request body onto the writable post columns. */
export function postPayload(request: RequestInstance): PostPayload {
  return {
    title: str(request.get('title')).trim(),
    excerpt: str(request.get('excerpt')),
    content: str(request.get('content') || request.get('body')),
    poster: str(request.get('poster')),
    status: normalizeStatus(request.get('status')),
  }
}
