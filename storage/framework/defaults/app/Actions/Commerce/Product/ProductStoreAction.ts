import { Action } from '@stacksjs/actions/runtime'

import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { commerceMinorAmountError } from '../commerce-action'

export default new Action({
  name: 'ProductItem Store',
  description: 'ProductItem Store ORM Action',
  method: 'POST',
  model: Product,
  async handle(request: RequestInstance) {
    await request.validate()
    const priceError = commerceMinorAmountError(request, 'price', 'Price', { required: true, min: 1 })
    if (priceError)
      return priceError
    // The dashboard sends camelCase (`imageUrl`); the table is snake_case, as
    // ProductUpdateAction already accounts for. Without this every product
    // added from the dashboard failed with "no column named imageUrl".
    const data = toSnakeCaseKeys(request.all())

    const model = await products.items.store(data)

    return response.json(model)
  },
})
