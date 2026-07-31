import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'DigitalDelivery Show',
  description: 'DigitalDelivery Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Digital delivery')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    const model = await shippings.digital.fetchById(id)
    if (!model)
      return commerceNotFound('Digital delivery', id)

    return response.json(model)
  },
})
