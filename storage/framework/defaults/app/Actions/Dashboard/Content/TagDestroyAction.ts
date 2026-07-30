import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { rowId } from './content-input'

/**
 * `DELETE /api/dashboard/tags/{id}` — deletes a CMS tag.
 *
 * Detaches related posts through the model relation before removing the tag so
 * no pivot rows are orphaned.
 */
export default new Action({
  name: 'TagDestroyAction',
  description: 'Deletes a CMS tag from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid tag id is required.' }, 422)

    const tag = await Tag.find(id)
    if (!tag)
      return response.json({ message: 'Tag not found.' }, 404)

    await tag.posts().detach()
    await tag.delete()

    return response.json({ message: 'Tag deleted.', id })
  },
})
