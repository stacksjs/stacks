import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { rowExists, rowId } from './content-input'

/** `DELETE /api/dashboard/pages/{id}` — deletes a CMS page from the dashboard. */
export default new Action({
  name: 'PageDestroyAction',
  description: 'Deletes a CMS page from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid page id is required.' }, 422)

    try {
      const deleted = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        if (!await rowExists('pages', id, trx))
          return false
        await trx.deleteFrom('pages').where('id', '=', id).execute()
        return true
      })

      if (!deleted)
        return response.json({ message: 'Page not found.' }, 404)

      return response.json({ message: 'Page deleted.', id })
    }
    catch (error) {
      return dashboardOperationalError(error, 'Page could not be deleted.', 'PageDestroyAction', 500)
    }
  },
})
