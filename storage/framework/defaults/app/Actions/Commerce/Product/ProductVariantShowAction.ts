import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ProductVariant Show',
  description: 'ProductVariant Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product variant')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await products.variants.fetchById(id)
    if (!model)
      return commerceNotFound('Product variant', id)

    return response.json(model)
  },
})
