import type { ProductUnitRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnit Store',
  description: 'ProductUnit Store ORM Action',
  method: 'POST',
  async handle(request: ProductUnitRequestType) {
    const model = await products.units.store(request)

    return response.json(model)
  },
})
