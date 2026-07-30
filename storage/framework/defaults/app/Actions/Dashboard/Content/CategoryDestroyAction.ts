import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { rowId } from './content-input'

/**
 * `DELETE /api/dashboard/categories/{id}` — deletes a CMS category.
 *
 * Detaches related posts through the model relation before removing the
 * category so no pivot rows are orphaned.
 */
export default new Action({
  name: 'CategoryDestroyAction',
  description: 'Deletes a CMS category from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid category id is required.' }, 422)

    const category = await Category.find(id)
    if (!category)
      return response.json({ message: 'Category not found.' }, 404)

    await category.posts().detach()
    await category.delete()

    return response.json({ message: 'Category deleted.', id })
  },
})
