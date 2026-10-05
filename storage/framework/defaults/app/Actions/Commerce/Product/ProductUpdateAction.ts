import { Action } from '@stacksjs/actions/runtime'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceIdentifier, commerceMinorAmountError, commerceNotFound } from '../commerce-action'

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
    const priceError = commerceMinorAmountError(request, 'price', 'Price', { min: 1 })
    if (priceError)
      return priceError
    const data = toSnakeCaseKeys(request.all())

    const model = await products.items.update(id, data)
    if (!model)
      return commerceNotFound('Product', id)

    return response.json(model)
  },
})
