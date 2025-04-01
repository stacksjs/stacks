import type { ProductItemRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductItem Store',
  description: 'ProductItem Store ORM Action',
  method: 'POST',
  async handle(request: ProductItemRequestType) {
    await request.validate()
    const model = await ProductItem.create(request.all())

    return response.json(model)
  },
})
