import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { normalizeCommentStatus } from './comment-input'

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
 * `GET /api/dashboard/comments` — backs `views/dashboard/content/comments/index.stx`.
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
    const rows = await db
      .selectFrom('comments')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute() as unknown as CommentRow[]

    const comments = rows.map(row => ({
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

    return { comments }
  },
})
