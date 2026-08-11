import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { rowId } from './content-input'

/**
 * `DELETE /api/dashboard/tags/{id}` — deletes a CMS tag.
 *
 * Detaches related posts through the model-declared pivot before removing the
 * tag, with both writes committed by the same transaction.
 */
export default new Action({
  name: 'TagDestroyAction',
  description: 'Deletes a CMS tag from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid tag id is required.' }, 422)

    try {
      const deleted = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const tag = await trx.selectFrom('tags').select(['id']).where('id', '=', id).executeTakeFirst()
        if (!tag)
          return false

        await trx
          .deleteFrom('taggable_models')
          .where('tag_id', '=', id)
          .where('taggable_type', '=', 'posts')
          .execute()
        await trx.deleteFrom('tags').where('id', '=', id).execute()
        return true
      })

      if (!deleted)
        return response.json({ message: 'Tag not found.' }, 404)

      return response.json({ message: 'Tag deleted.', id })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Tag could not be deleted.', 'TagDestroyAction', 500)
    }
  },
})
