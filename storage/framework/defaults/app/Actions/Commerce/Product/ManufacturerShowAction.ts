import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Manufacturer Show',
  description: 'Manufacturer Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Manufacturer')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await products.manufacturers.fetchById(id)
    if (!model)
      return commerceNotFound('Manufacturer', id)

    return response.json(model)
  },
})
