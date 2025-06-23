import type { ProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductItem Store',
  description: 'ProductItem Store ORM Action',
  method: 'POST',
  async handle(request: ProductRequestType) {
    const data = request.all()

    const model = await products.items.store(data)

    return response.json(model)
  },
})
