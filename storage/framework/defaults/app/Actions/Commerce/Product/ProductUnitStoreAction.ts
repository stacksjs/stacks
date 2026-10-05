import { Action } from '@stacksjs/actions/runtime'

import { products } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnit Store',
  description: 'Creates a product unit through the native commerce module.',
  method: 'POST',
  model: ProductUnit,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await products.units.store(data)

    return response.json(model)
  },
})
