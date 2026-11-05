import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseCommentListQuery, readCommentPage } from './comment-list'

/**
 * `GET /api/dashboard/comments` — backs `views/dashboard/content/comments/index.stx`.
 *
 * Lists both places a comment can live, newest first, one page at a time:
 * the model-backed `comments` table and the polymorphic `commentables` table
 * the `commentable` trait writes (`comment-list.ts`, stacksjs/stacks#3193).
 * Their ids overlap, so every record carries its `source` and a `key` unique
 * across both, and the moderation writes take `source` back.
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
  async handle(request: RequestInstance) {
    const query = parseCommentListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const result = await readCommentPage(query)

      return {
        comments: result.rows,
        total: result.total,
        page: result.page,
        perPage: query.perPage,
        counts: result.counts,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Comments could not be loaded.', 'CommentIndexAction')
    }
  },
})
