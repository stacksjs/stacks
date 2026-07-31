import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Product Destroy',
  description: 'Product Destroy ORM Action',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const deleted = await products.items.destroy(id)
    if (!deleted)
      return commerceNotFound('Product', id)

    return response.noContent()
  },
})
