import type { ProductUnitRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnit Show',
  description: 'ProductUnit Show ORM Action',
  method: 'GET',
  async handle(request: ProductUnitRequestType) {
    const id = request.getParam('id')

    const model = await products.units.fetchById(id)

    return response.json(model)
  },
})
