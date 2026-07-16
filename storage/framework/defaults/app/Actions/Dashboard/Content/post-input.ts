import type { RequestInstance } from '@stacksjs/types'
import { db } from '@stacksjs/database'

export interface PostPayload {
  title: string
  excerpt: string
  content: string
  poster: string
  status: string
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
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

/** `YYYY-MM-DD HH:MM:SS`, matching the table's CURRENT_TIMESTAMP default. */
export function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
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

/**
 * Reads a post row back after a write.
 *
 * The SQLite driver in use does not honour `RETURNING` — `.returningAll()`
 * resolves to a `{ changes, lastInsertRowid }` summary rather than the row — so
 * writes re-select instead of trusting the insert/update result.
 */
export async function findPost(id: number): Promise<unknown> {
  return await db.selectFrom('posts').selectAll().where('id', '=', id).executeTakeFirst()
}

/** The new row's id, across the driver shapes we may get back from an insert. */
export function insertedId(result: unknown): number {
  const row = result as { lastInsertRowid?: number | bigint, insertId?: number | bigint } | undefined

  return Number(row?.lastInsertRowid ?? row?.insertId ?? 0)
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
