import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceNotFound } from '../commerce-action'

export default new Action({
  name: 'ProductVariant Update',
  description: 'Updates a product variant through the native commerce module.',
  method: 'PATCH',
  model: ProductVariant,
  async handle(request: RequestInstance) {
    const identifier = commerceIdentifier(request, 'Product variant')
    if (identifier.error)
      return identifier.error
    const { id } = identifier

    await request.validate()
    const data = toSnakeCaseKeys(request.all())
    const result = await products.variants.update(id, data)
    if (!result)
      return commerceNotFound('Product variant', id)

    return response.json(result)
  },
})
