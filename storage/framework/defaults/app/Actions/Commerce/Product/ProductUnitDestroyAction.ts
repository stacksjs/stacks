import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ProductUnit Destroy',
  description: 'Deletes a product unit through the native commerce module.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product unit')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await products.units.destroy(id)
    if (!deleted)
      return commerceNotFound('Product unit', id)

    return response.noContent()
  },
})
