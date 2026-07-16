import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { rowExists, rowId } from './content-input'

/**
 * `DELETE /api/dashboard/categories/{id}` — deletes a CMS category.
 *
 * A plain row delete: this schema has no `categorizable_models` pivot table, so
 * there is nothing to cascade to.
 */
export default new Action({
  name: 'CategoryDestroyAction',
  description: 'Deletes a CMS category from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid category id is required.' }, 422)

    if (!await rowExists('categories', id))
      return response.json({ message: 'Category not found.' }, 404)

    await db.deleteFrom('categories').where('id', '=', id).execute()

    return response.json({ message: 'Category deleted.', id })
  },
})
