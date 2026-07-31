import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

export default new Action({
  name: 'Review Destroy',
  description: 'Deletes a product review through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Review')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await products.reviews.destroy(id)
    if (!deleted)
      return commerceNotFound('Review', id)

    return response.noContent()
  },
})
