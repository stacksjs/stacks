import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Manufacturer Update',
  description: 'Updates a manufacturer through the native commerce module.',
  method: 'PATCH',
  model: Manufacturer,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Manufacturer')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const model = await products.manufacturers.update(id, data)
    if (!model)
      return commerceNotFound('Manufacturer', id)

    return response.json(model)
  },
})
