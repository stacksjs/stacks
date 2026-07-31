import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ProductVariant Destroy',
  description: 'Deletes a product variant through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product variant')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await products.variants.destroy(id)
    if (!deleted)
      return commerceNotFound('Product variant', id)

    return response.noContent()
  },
})
