import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'Product Update',
  description: 'Product Update ORM Action',
  method: 'PATCH',
  model: Product,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())

    const model = await products.items.update(id, data)
    if (!model)
      return commerceNotFound('Product', id)

    return response.json(model)
  },
})
