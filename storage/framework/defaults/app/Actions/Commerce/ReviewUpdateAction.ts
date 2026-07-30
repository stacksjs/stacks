import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Review Update',
  description: 'Updates a product review through the native commerce module.',
  method: 'PATCH',
  model: Review,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = Number(request.getParam('id'))
    const data = toSnakeCaseKeys(request.all())
    const model = await products.reviews.update(id, data)

    return response.json(model)
  },
})
