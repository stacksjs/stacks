import type { ProductManufacturerRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductManufacturer Show',
  description: 'ProductManufacturer Show ORM Action',
  method: 'GET',
  async handle(request: ProductManufacturerRequestType) {
    const id = request.getParam('id')

    const model = await ProductManufacturer.findOrFail(Number(id))

    return response.json(model)
  },
})
