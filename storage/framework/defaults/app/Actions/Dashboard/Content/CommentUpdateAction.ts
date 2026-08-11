import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { COMMENT_STATUSES, parseCommentStatus } from './comment-input'
import { findRow, rowExists, rowId, timestamp } from './content-input'

/**
 * `PATCH /api/dashboard/comments/{id}` — moderates a comment from the dashboard.
 *
 * Status is the only writable field: the page's approve/spam buttons are the
 * only callers, and comment text belongs to the reader who wrote it.
 *
 * `is_approved` is kept in step with `status` so the two never disagree — the
 * table carries both, and the page falls back to `is_approved` when a row has
 * no status.
 */
export default new Action({
  name: 'CommentUpdateAction',
  description: 'Updates a CMS comment status from the dashboard.',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid comment id is required.' }, 422)

    const status = parseCommentStatus(request.get('status'))

    if (!status)
      return response.json({ message: `Status must be one of: ${COMMENT_STATUSES.join(', ')}.` }, 422)

    try {
      const comment = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        if (!await rowExists('comments', id, trx))
          return null

        await trx
          .updateTable('comments')
          .set({
            status,
            is_approved: status === 'approved' ? 1 : 0,
            updated_at: timestamp(),
          } as any)
          .where('id', '=', id)
          .execute()

        const updated = await findRow('comments', id, trx)
        if (!updated)
          throw new Error('Updated comment could not be loaded.')
        return updated
      })

      if (!comment)
        return response.json({ message: 'Comment not found.' }, 404)

      return response.json(comment)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Comment could not be updated.', 'CommentUpdateAction', 500)
    }
  },
})
