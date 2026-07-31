import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ProductUnit Update',
  description: 'Updates a product unit through the native commerce module.',
  method: 'PATCH',
  model: ProductUnit,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product unit')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const model = await products.units.update(id, data)
    if (!model)
      return commerceNotFound('Product unit', id)

    return response.json(model)
  },
})
