import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { detachPostRelations } from './post-input'

/**
 * `DELETE /api/dashboard/posts/{id}` — deletes a CMS post from the dashboard.
 *
 * Detaches the model-declared category and tag pivots before removing the post,
 * with all three writes committed by the same transaction.
 */
export default new Action({
  name: 'PostDestroyAction',
  description: 'Deletes a CMS post from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))

    if (!Number.isInteger(id) || id <= 0)
      return response.json({ message: 'A valid post id is required.' }, 422)

    try {
      const deleted = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const post = await trx.selectFrom('posts').select(['id']).where('id', '=', id).executeTakeFirst()

        if (!post)
          return false

        await detachPostRelations(trx, id)
        await trx.deleteFrom('posts').where('id', '=', id).execute()
        return true
      })

      if (!deleted)
        return response.json({ message: 'Post not found.' }, 404)

      return response.json({ message: 'Post deleted.', id })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Post could not be deleted.', 'PostDestroyAction', 500)
    }
  },
})
