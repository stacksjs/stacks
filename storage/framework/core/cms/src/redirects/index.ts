import { formatDate } from '@stacksjs/orm'
import { getDb } from '../database'

export interface ResolvedRedirect {
  toPath: string
  statusCode: 301 | 302
}

/** Look up a redirect for a missed path on a site, or null. */
export async function resolveRedirect(siteId: number, path: string): Promise<ResolvedRedirect | null> {
  const db = await getDb()
  const row = await db
    .selectFrom('redirects')
    .where('site_id', '=', siteId)
    .where('from_path', '=', path)
    .select(['to_path', 'status_code'])
    .executeTakeFirst() as { to_path: string, status_code: number } | undefined

  if (!row)
    return null

  return {
    toPath: row.to_path,
    statusCode: row.status_code === 302 ? 302 : 301,
  }
}

export interface PathMove {
  fromPath: string
  toPath: string
}

/**
 * Record redirects for a set of path moves (a slug change plus every
 * descendant it dragged along). Upserts: a later move overwrites an older
 * redirect from the same path, and a redirect that would point at itself is
 * skipped. Also drops any old redirect TO a path that just became a source,
 * so chains collapse instead of loop.
 */
export async function recordSlugChangeRedirects(siteId: number, moves: PathMove[]): Promise<void> {
  const db = await getDb()

  for (const move of moves) {
    if (!move.fromPath || move.fromPath === move.toPath)
      continue

    // A page moving back onto a path that previously redirected away from it
    // makes that redirect wrong - remove it.
    await db
      .deleteFrom('redirects')
      .where('site_id', '=', siteId)
      .where('from_path', '=', move.toPath)
      .execute()

    await db
      .deleteFrom('redirects')
      .where('site_id', '=', siteId)
      .where('from_path', '=', move.fromPath)
      .execute()

    // Any existing redirect pointing AT the old path follows the move, so a
    // twice-renamed page keeps one-hop redirects.
    await db
      .updateTable('redirects')
      .set({ to_path: move.toPath, updated_at: formatDate(new Date()) })
      .where('site_id', '=', siteId)
      .where('to_path', '=', move.fromPath)
      .execute()

    await db
      .insertInto('redirects')
      .values({
        site_id: siteId,
        from_path: move.fromPath,
        to_path: move.toPath,
        status_code: 301,
        source: 'slug-change',
        created_at: formatDate(new Date()),
        updated_at: formatDate(new Date()),
      })
      .execute()
  }
}
