import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database/runtime'
import { dashboardOperationalError } from '../dashboard-response'
import type { CommentableRow, DashboardComment } from './comment-input'
import { commentableRecord, isMissingTableError, isSafeTableName, newestFirst, normalizeCommentStatus } from './comment-input'

interface CommentRow {
  id: number
  author_name: string | null
  author_email: string | null
  content: string | null
  body: string | null
  post_title: string | null
  status: string | null
  is_approved: number | null
  created_at: string | null
  updated_at: string | null
}

/**
 * What each trait comment was left on, keyed `type:id`: the owner's title, else
 * its name, else `posts #3`. `commentables_type` is the owner's table, so this
 * is a join done per type, because one SQL join cannot follow a polymorphic
 * key. A type that is not a safe identifier, has no such table, or has neither
 * column falls back to the plain label rather than failing the whole list.
 */
async function ownerLabels(rows: CommentableRow[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  const idsByType = new Map<string, number[]>()

  for (const row of rows) {
    const type = String(row.commentables_type || '')
    labels.set(`${type}:${row.commentables_id}`, `${type} #${row.commentables_id}`)
    if (isSafeTableName(type))
      idsByType.set(type, [...(idsByType.get(type) ?? []), Number(row.commentables_id)])
  }

  for (const [type, ids] of idsByType) {
    for (const column of ['title', 'name']) {
      try {
        const owners = await (db as any)
          .selectFrom(type)
          .select(['id', column])
          .whereIn('id', [...new Set(ids)])
          .execute() as Array<Record<string, unknown>>

        for (const owner of owners) {
          const label = String(owner[column] ?? '').trim()
          if (label)
            labels.set(`${type}:${owner.id}`, label)
        }
        break
      }
      catch {
        // No such table or no such column: try the next column, then keep
        // the fallback label.
      }
    }
  }

  return labels
}

/**
 * Comments the `commentable` trait wrote. An app that has never migrated the
 * trait tables has none, which is not an error; any other failure is.
 */
async function commentableComments(): Promise<DashboardComment[]> {
  let rows: CommentableRow[]
  try {
    rows = await db
      .selectFrom('commentables')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute() as unknown as CommentableRow[]
  }
  catch (error) {
    if (isMissingTableError(error))
      return []
    throw error
  }

  const labels = await ownerLabels(rows)

  return rows.map(row => commentableRecord(row, labels.get(`${row.commentables_type}:${row.commentables_id}`) ?? ''))
}

/**
 * `GET /api/dashboard/comments` — backs `views/dashboard/content/comments/index.stx`.
 *
 * Lists both places a comment can live, newest first: the model-backed
 * `comments` table and the polymorphic `commentables` table the `commentable`
 * trait writes. Their ids overlap, so every record carries its `source` and a
 * `key` unique across both, and the moderation writes take `source` back.
 *
 * Reads the `comments` table via `db`. The previous `Comment.orderBy(...)` call
 * threw on every request (the ORM model exposes no query methods) and the catch
 * turned that into an empty list, so a broken read looked like a CMS with no
 * comments. It also mapped `author` / `email` / `ip` / `post_id`, none of which
 * this table has — the columns are `author_name`, `author_email`, `ip_address`,
 * and there is no post foreign key, only the denormalized `post_title`.
 *
 * Column names are returned as-is; the page normalizes them client-side.
 */
export default new Action({
  name: 'CommentIndexAction',
  description: 'Returns CMS comments for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await db
        .selectFrom('comments')
        .selectAll()
        .orderBy('created_at', 'desc')
        .execute() as unknown as CommentRow[]

      const legacy: DashboardComment[] = rows.map(row => ({
        key: `comments:${row.id}`,
        source: 'comments',
        id: Number(row.id),
        author_name: String(row.author_name || ''),
        author_email: String(row.author_email || ''),
        content: String(row.content || row.body || ''),
        post_title: String(row.post_title || ''),
        status: normalizeCommentStatus(row.status),
        is_approved: Boolean(row.is_approved),
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
      }))

      const comments = [...legacy, ...await commentableComments()].sort(newestFirst)

      return { comments }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Comments could not be loaded.', 'CommentIndexAction')
    }
  },
})
