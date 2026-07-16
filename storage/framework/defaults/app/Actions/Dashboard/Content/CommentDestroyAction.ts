import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { rowExists, rowId } from './content-input'

/**
 * `DELETE /api/dashboard/comments/{id}` — deletes a comment from the dashboard.
 *
 * A hard delete. The `trash` status exists for the reversible case, and the
 * page's delete button confirms first.
 */
export default new Action({
  name: 'CommentDestroyAction',
  description: 'Deletes a CMS comment from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid comment id is required.' }, 422)

    if (!await rowExists('comments', id))
      return response.json({ message: 'Comment not found.' }, 404)

    await db.deleteFrom('comments').where('id', '=', id).execute()

    return response.json({ message: 'Comment deleted.', id })
  },
})
