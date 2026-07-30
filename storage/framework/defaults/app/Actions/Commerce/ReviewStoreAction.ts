import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Review Store',
  description: 'Creates a product review through the native commerce module.',
  method: 'POST',
  model: Review,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await products.reviews.store(data)

    return response.json(model)
  },
})
