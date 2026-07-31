import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'DigitalDelivery Update',
  description: 'DigitalDelivery Update ORM Action',
  method: 'PATCH',
  model: DigitalDelivery,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Digital delivery')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = await request.all()

    const model = await shippings.digital.update(id, data)
    if (!model)
      return commerceNotFound('Digital delivery', id)

    return response.json(model)
  },
})
