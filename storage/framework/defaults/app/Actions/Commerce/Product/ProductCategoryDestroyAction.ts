import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Product Category Destroy',
  description: 'Deletes a product category through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product category')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await products.categories.remove(id)
    if (!deleted)
      return commerceNotFound('Product category', id)

    return response.noContent()
  },
})
