import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Store',
  description: 'Creates a product variant through the native commerce module.',
  method: 'POST',
  model: ProductVariant,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await products.variants.store(data)

    return response.json(model)
  },
})
