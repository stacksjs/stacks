import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
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

    if (!await rowExists('pages', id))
      return response.json({ message: 'Page not found.' }, 404)

    await db.deleteFrom('pages').where('id', '=', id).execute()

    return response.json({ message: 'Page deleted.', id })
  },
})
