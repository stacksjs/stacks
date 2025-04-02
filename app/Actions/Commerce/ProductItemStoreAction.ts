import type { ProductItemRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductItem Store',
  description: 'ProductItem Store ORM Action',
  method: 'POST',
  async handle(request: ProductItemRequestType) {
    const model = await products.items.store(request)

    return response.json(model)
  },
})
