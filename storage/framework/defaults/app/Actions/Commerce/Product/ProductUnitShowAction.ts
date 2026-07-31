import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ProductUnit Show',
  description: 'ProductUnit Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product unit')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await products.units.fetchById(id)
    if (!model)
      return commerceNotFound('Product unit', id)

    return response.json(model)
  },
})
