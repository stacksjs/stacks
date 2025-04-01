import type { ProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Product Show',
  description: 'Product Show ORM Action',
  method: 'GET',
  async handle(request: ProductRequestType) {
    const id = request.getParam('id')

    const model = await Product.findOrFail(Number(id))

    return response.json(model)
  },
})
