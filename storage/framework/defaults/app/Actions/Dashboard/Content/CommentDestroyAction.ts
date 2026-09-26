import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database/runtime'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { COMMENT_SOURCES, parseCommentSource } from './comment-input'
import { rowExists, rowId } from './content-input'

/**
 * `DELETE /api/dashboard/comments/{id}` — deletes a comment from the dashboard.
 *
 * A hard delete. The `trash` status exists for the reversible case, and the
 * page's delete button confirms first.
 *
 * `?source=commentables` deletes a comment the `commentable` trait wrote; the
 * two tables number their rows independently, so the id alone is ambiguous.
 */
export default new Action({
  name: 'CommentDestroyAction',
  description: 'Deletes a CMS comment from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid comment id is required.' }, 422)

    const source = parseCommentSource(request.get('source'))

    if (!source)
      return response.json({ message: `Source must be one of: ${COMMENT_SOURCES.join(', ')}.` }, 422)

    try {
      const deleted = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        if (!await rowExists(source, id, trx))
          return false
        await trx.deleteFrom(source).where('id', '=', id).execute()
        return true
      })

      if (!deleted)
        return response.json({ message: 'Comment not found.' }, 404)

      return response.json({ message: 'Comment deleted.', id, source })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Comment could not be deleted.', 'CommentDestroyAction', 500)
    }
  },
})
