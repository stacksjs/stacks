import type { ManufacturerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductManufacturer Update',
  description: 'ProductManufacturer Update ORM Action',
  method: 'PATCH',
  async handle(request: ManufacturerRequestType) {
    const id = request.getParam('id')

    const result = await products.manufacturers.update(id, request)

    return response.json(result)
  },
})
