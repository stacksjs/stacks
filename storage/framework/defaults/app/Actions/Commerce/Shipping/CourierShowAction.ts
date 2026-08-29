import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Courier Show',
  description: 'Courier Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Courier')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.couriers.fetchById(id)
    if (!model)
      return commerceNotFound('Courier', id)

    return response.json(model)
  },
})
