import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { rowExists, rowId } from './content-input'

/**
 * `DELETE /api/dashboard/tags/{id}` — deletes a CMS tag.
 *
 * A plain row delete: this schema has no `taggable_models` pivot table, so
 * there is nothing to cascade to.
 */
export default new Action({
  name: 'TagDestroyAction',
  description: 'Deletes a CMS tag from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid tag id is required.' }, 422)

    if (!await rowExists('tags', id))
      return response.json({ message: 'Tag not found.' }, 404)

    await db.deleteFrom('tags').where('id', '=', id).execute()

    return response.json({ message: 'Tag deleted.', id })
  },
})
