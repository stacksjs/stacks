import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Product Category Update',
  description: 'Updates a product category through the native commerce module.',
  method: 'PATCH',
  model: Category,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product category')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const model = await products.categories.update(id, data)
    if (!model)
      return commerceNotFound('Product category', id)

    return response.json(model)
  },
})
