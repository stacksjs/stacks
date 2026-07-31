import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Driver Show',
  description: 'Driver Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Driver')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.drivers.fetchById(id)
    if (!model)
      return commerceNotFound('Driver', id)

    return response.json(model)
  },
})
