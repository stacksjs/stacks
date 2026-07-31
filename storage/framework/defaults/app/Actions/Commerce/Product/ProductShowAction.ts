import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ProductItem Show',
  description: 'ProductItem Show ORM Action',
  method: 'GET',

  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await products.items.fetchById(id)
    if (!model)
      return commerceNotFound('Product', id)

    return response.json(model)
  },
})
