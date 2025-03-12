import type { ProductItemRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductItem Show',
  description: 'ProductItem Show ORM Action',
  method: 'GET',
  async handle(request: ProductItemRequestType) {
    const id = request.getParam('id')

    const model = await ProductItem.findOrFail(Number(id))

    return response.json(model)
  },
})
