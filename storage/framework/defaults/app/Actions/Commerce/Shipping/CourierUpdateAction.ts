import { Action } from '@stacksjs/actions'

import { shippings } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Courier Update',
  description: 'Courier Update ORM Action',
  method: 'PATCH',
  model: Courier,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Courier')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = await request.all()

    const model = await shippings.couriers.update(id, data)
    if (!model)
      return commerceNotFound('Courier', id)

    return response.json(model)
  },
})
