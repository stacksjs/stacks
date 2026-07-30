import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Update',
  description: 'Updates a product variant through the native commerce module.',
  method: 'PATCH',
  model: ProductVariant,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = Number(request.getParam('id'))
    const data = toSnakeCaseKeys(request.all())
    const result = await products.variants.update(id, data)

    return response.json(result)
  },
})
