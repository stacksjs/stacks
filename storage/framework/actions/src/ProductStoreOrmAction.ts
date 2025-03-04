import type { ProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Product Store',
  description: 'Product Store ORM Action',
  method: 'POST',
  async handle(request: ProductRequestType) {
    await request.validate()
    const model = await Product.create(request.all())

    return response.json(model)
  },
})
