import { Action } from '@stacksjs/actions/runtime'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Product Category Store',
  description: 'Creates a product category through the native commerce module.',
  method: 'POST',
  model: Category,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await products.categories.store(data)

    return response.json(model)
  },
})
