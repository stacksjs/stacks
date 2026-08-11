import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { rowId } from './content-input'

/**
 * `DELETE /api/dashboard/categories/{id}` — deletes a CMS category.
 *
 * Detaches related posts through the model-declared pivot before removing the
 * category, with both writes committed by the same transaction.
 */
export default new Action({
  name: 'CategoryDestroyAction',
  description: 'Deletes a CMS category from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid category id is required.' }, 422)

    try {
      const deleted = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const category = await trx.selectFrom('categories').select(['id']).where('id', '=', id).executeTakeFirst()
        if (!category)
          return false

        await trx
          .deleteFrom('categorizable_models')
          .where('category_id', '=', id)
          .where('categorizable_type', '=', 'posts')
          .execute()
        await trx.deleteFrom('categories').where('id', '=', id).execute()
        return true
      })

      if (!deleted)
        return response.json({ message: 'Category not found.' }, 404)

      return response.json({ message: 'Category deleted.', id })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Category could not be deleted.', 'CategoryDestroyAction', 500)
    }
  },
})
